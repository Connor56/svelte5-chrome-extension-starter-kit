<script lang="ts">
  import { onMount } from "svelte";
  
  // Theme management (persisted via chrome.storage.local)
  type Theme = "light" | "dark";
  let theme = $state<Theme>("light");

  // Global UI state
  const tabs = [
    "Overview",
    "Tools",
    "Tabs",
    "Storage",
    "Messages",
    "Settings",
    "About",
  ] as const;
  type PanelTab = typeof tabs[number];
  let activeTab = $state<PanelTab>("Overview");
  let searchQuery = $state("");
  let isBusy = $state(false);

  // Toast system (DaisyUI toast)
  type ToastType = "info" | "success" | "warning" | "error";
  type Toast = { id: number; type: ToastType; message: string; timeout?: number };
  let toasts = $state<Toast[]>([]);
  let toastIdCounter = 0;
  function pushToast(type: ToastType, message: string, timeout = 3000) {
    const id = ++toastIdCounter;
    toasts = [...toasts, { id, type, message, timeout }];
    if (timeout > 0) {
      setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), timeout);
    }
  }
  function clearToasts() {
    toasts = [];
  }

  // Simple helpers for chrome.storage.local
  async function storageGet<T>(key: string, fallback: T): Promise<T> {
    try {
      const data = await chrome.storage.local.get(key);
      return (data?.[key] as T) ?? fallback;
    } catch {
      return fallback;
    }
  }
  async function storageSet<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  // Clipboard helpers
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", "Copied to clipboard");
    } catch (err) {
      pushToast("error", "Clipboard copy failed");
    }
  }

  // Current tab info
  type SimpleTab = { id?: number; title?: string; url?: string; active?: boolean };
  let currentTab = $state<SimpleTab>({});
  async function refreshCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab ? { id: tab.id, title: tab.title, url: tab.url, active: tab.active } : {};
  }
  async function activateTab(tabId?: number) {
    if (!tabId) return;
    await chrome.tabs.update(tabId, { active: true });
    await refreshCurrentTab();
  }

  // List all tabs in window (with filter)
  let allTabs = $state<SimpleTab[]>([]);
  let filteredTabs = $derived(
    allTabs.filter((t: SimpleTab) => {
      const haystacks = [t.title ?? "", t.url ?? ""];
      const needle = searchQuery.toLowerCase();
      return haystacks.some((v: string) => v.toLowerCase().includes(needle));
    })
  );
  async function loadAllTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    allTabs = tabs.map((t: any) => ({ id: t.id, title: t.title, url: t.url, active: t.active }));
  }

  // Messaging
  let lastMessageResponse = $state<string>("");
  async function sendToBackground(payload: unknown) {
    try {
      isBusy = true;
      const response = await chrome.runtime.sendMessage({ source: "sidepanel", payload });
      lastMessageResponse = JSON.stringify(response, null, 2);
      pushToast("success", "Background responded");
    } catch (err) {
      lastMessageResponse = String(err);
      pushToast("error", "Background message failed");
    } finally {
      isBusy = false;
    }
  }
  async function sendToActiveTab(payload: unknown) {
    try {
      isBusy = true;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { source: "sidepanel", payload });
      lastMessageResponse = JSON.stringify(response, null, 2);
      pushToast("success", "Content script responded");
    } catch (err) {
      lastMessageResponse = String(err);
      pushToast("warning", "Content script may not be injected on this page");
    } finally {
      isBusy = false;
    }
  }

  // Quick actions
  async function reloadExtension() {
    try {
      await chrome.runtime.reload();
    } catch {
      pushToast("error", "Extension reload failed");
    }
  }
  async function openOptions() {
    try {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    } catch {
      pushToast("error", "Unable to open options page");
    }
  }
  async function setActionBadge(text: string) {
    try {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
      pushToast("success", `Badge set to "${text}"`);
    } catch {
      pushToast("warning", "Badge API not available in this context");
    }
  }

  // Tools tab state
  let textToolInput = $state("");
  let textToolOutput = $state("");
  function urlEncode() {
    textToolOutput = encodeURIComponent(textToolInput);
  }
  function urlDecode() {
    try {
      textToolOutput = decodeURIComponent(textToolInput);
    } catch {
      pushToast("error", "Invalid URL-encoded input");
    }
  }
  function base64Encode() {
    try {
      textToolOutput = btoa(unescape(encodeURIComponent(textToolInput)));
    } catch {
      pushToast("error", "Base64 encode failed");
    }
  }
  function base64Decode() {
    try {
      textToolOutput = decodeURIComponent(escape(atob(textToolInput)));
    } catch {
      pushToast("error", "Base64 decode failed");
    }
  }
  function slugify() {
    textToolOutput = textToolInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  // Storage playground
  let kvKey = $state("demo:key");
  let kvValue = $state("");
  async function kvSave() {
    await storageSet(kvKey, kvValue);
    pushToast("success", `Saved ${kvKey}`);
  }
  async function kvLoad() {
    kvValue = await storageGet(kvKey, "");
    pushToast("info", `Loaded ${kvKey}`);
  }
  async function kvRemove() {
    try {
      await chrome.storage.local.remove(kvKey);
      kvValue = "";
      pushToast("success", `Removed ${kvKey}`);
    } catch {
      pushToast("error", "Remove failed");
    }
  }

  // Settings (persisted)
  let enableDebug = $state(false);
  let autoOpenOnSites = $state<string[]>([]);
  const availableSites = ["github.com", "developer.chrome.com", "svelte.dev"];
  async function loadSettings() {
    theme = await storageGet<Theme>("ui:theme", "light");
    enableDebug = await storageGet<boolean>("settings:debug", false);
    autoOpenOnSites = await storageGet<string[]>("settings:autoOpenSites", []);
    applyTheme(theme);
  }
  async function saveSettings() {
    await storageSet("ui:theme", theme);
    await storageSet("settings:debug", enableDebug);
    await storageSet("settings:autoOpenSites", autoOpenOnSites);
    pushToast("success", "Settings saved");
  }
  function applyTheme(t: Theme) {
    document.documentElement.setAttribute("data-theme", t);
  }

  $effect(() => {
    // Keep theme attribute in sync
    applyTheme(theme);
  });

  onMount(async () => {
    await loadSettings();
    await refreshCurrentTab();
    await loadAllTabs();
  });

  // About
  const manifest = {}//chrome.runtime.getManifest();
</script>

<div class="h-screen bg-base-100 flex flex-col">
  <!-- Navbar -->
  <div class="navbar bg-base-100 border-b border-base-200 px-4">
    <div class="flex-1">
      <div class="font-semibold text-lg">{manifest.name}</div>
      <div class="badge badge-outline ml-2">v{manifest.version}</div>
    </div>
    <div class="flex items-center gap-2">
      <select class="select select-sm select-bordered" bind:value={theme} aria-label="Theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <button class="btn btn-sm" onclick={openOptions}>Options</button>
    </div>
  </div>

  <!-- Search + Tabs -->
  <div class="p-3 border-b border-base-200 flex items-center gap-3">
    <input
      class="input input-bordered input-sm w-full"
      placeholder="Search tabs, tools, or text..."
      bind:value={searchQuery}
    />
    <div class="tabs tabs-boxed tabs-sm">
      {#each tabs as t}
        <button
          type="button"
          class="tab {activeTab === t ? 'tab-active' : ''}"
          onclick={() => (activeTab = t)}
        >{t}</button>
      {/each}
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 overflow-auto p-3 space-y-3">
    {#if activeTab === "Overview"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body">
            <div class="card-title">Quick Actions</div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-primary btn-sm" onclick={refreshCurrentTab}>Refresh Tab</button>
              <button class="btn btn-secondary btn-sm" onclick={() => setActionBadge("NEW")}>Set Badge</button>
              <button class="btn btn-accent btn-sm" onclick={reloadExtension}>Reload Extension</button>
              <button class="btn btn-outline btn-sm" onclick={() => copyToClipboard(currentTab.url ?? "")}>Copy URL</button>
            </div>
            <div class="divider my-2"></div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="stat">
                <div class="stat-title">Active Tab</div>
                <div class="stat-value text-lg truncate" title={currentTab.title}>{currentTab.title ?? 'N/A'}</div>
                <div class="stat-desc truncate" title={currentTab.url}>{currentTab.url ?? 'N/A'}</div>
              </div>
              <div class="stat">
                <div class="stat-title">Tabs in Window</div>
                <div class="stat-value text-lg">{allTabs.length}</div>
                <div class="stat-desc">Filtered: {filteredTabs.length}</div>
              </div>
              <div class="stat">
                <div class="stat-title">Theme</div>
                <div class="stat-value text-lg capitalize">{theme}</div>
                <div class="stat-desc">Persistent</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "Tools"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">Text Utilities</div>
            <textarea class="textarea textarea-bordered min-h-24" placeholder="Paste or type text here" bind:value={textToolInput}></textarea>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm" onclick={urlEncode}>URL Encode</button>
              <button class="btn btn-sm" onclick={urlDecode}>URL Decode</button>
              <button class="btn btn-sm" onclick={base64Encode}>Base64 Encode</button>
              <button class="btn btn-sm" onclick={base64Decode}>Base64 Decode</button>
              <button class="btn btn-sm" onclick={slugify}>Slugify</button>
            </div>
            <textarea class="textarea textarea-bordered min-h-24" readonly placeholder="Output" bind:value={textToolOutput}></textarea>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick={() => copyToClipboard(textToolOutput)}>Copy Output</button>
              <button class="btn btn-ghost btn-sm" onclick={() => (textToolInput = textToolOutput)}>Use Output as Input</button>
              <button class="btn btn-outline btn-sm" onclick={() => { textToolInput = ''; textToolOutput = ''; }}>Clear</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "Tabs"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">Open Tabs</div>
            <div class="flex items-center gap-2">
              <button class="btn btn-sm" onclick={loadAllTabs}>Refresh</button>
              <div class="text-sm opacity-70">{filteredTabs.length} / {allTabs.length}</div>
            </div>
            <div class="max-h-64 overflow-auto divide-y divide-base-300 rounded border border-base-300">
              {#each filteredTabs as t (t.id)}
                <div class="p-2 hover:bg-base-300 text-left w-full flex items-center gap-2" role="button" tabindex="0" onclick={() => activateTab(t.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') activateTab(t.id); }} title={t.url}>
                  {#if t.active}
                    <span class="badge badge-primary badge-sm">Active</span>
                  {/if}
                  <div class="truncate flex-1">{t.title ?? t.url ?? '(untitled)'}</div>
                  <button class="btn btn-ghost btn-xs" onclick={(e) => { e.stopPropagation(); copyToClipboard(t.url ?? ''); }}>Copy URL</button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "Storage"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">Key/Value Playground</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <input class="input input-bordered input-sm" placeholder="Key" bind:value={kvKey} />
              <input class="input input-bordered input-sm sm:col-span-2" placeholder="Value" bind:value={kvValue} />
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary" onclick={kvSave}>Save</button>
              <button class="btn btn-sm" onclick={kvLoad}>Load</button>
              <button class="btn btn-sm btn-outline" onclick={kvRemove}>Remove</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "Messages"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">Runtime Messaging</div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-primary btn-sm" disabled={isBusy} onclick={() => sendToBackground({ action: 'ping' })}>Ping Background</button>
              <button class="btn btn-secondary btn-sm" disabled={isBusy} onclick={() => sendToActiveTab({ action: 'ping' })}>Ping Content</button>
            </div>
            <textarea class="textarea textarea-bordered min-h-32 font-mono" readonly bind:value={lastMessageResponse} placeholder="Response will appear here"></textarea>
            <div class="text-xs opacity-70">Note: Content message requires a content script matched to the current page.</div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "Settings"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">Preferences</div>
            <label class="label cursor-pointer justify-start gap-3">
              <span class="label-text">Enable debug logs</span>
              <input type="checkbox" class="toggle" bind:checked={enableDebug} />
            </label>
            <div>
              <div class="mb-2 font-medium">Auto-open sidepanel on sites</div>
              <div class="flex flex-wrap gap-2">
                {#each availableSites as site}
                  <label class="badge badge-outline gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={autoOpenOnSites.includes(site)}
                      onchange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        autoOpenOnSites = checked
                          ? [...autoOpenOnSites, site]
                          : autoOpenOnSites.filter((s) => s !== site);
                      }}
                    />
                    {site}
                  </label>
                {/each}
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick={saveSettings}>Save</button>
              <button class="btn btn-ghost btn-sm" onclick={loadSettings}>Reset</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if activeTab === "About"}
      <div class="grid grid-cols-1 gap-3">
        <div class="card bg-base-200 shadow">
          <div class="card-body gap-3">
            <div class="card-title">About This Extension</div>
            <div class="text-sm opacity-80">{manifest.description}</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div><span class="opacity-70">Version:</span> {manifest.version}</div>
              <div><span class="opacity-70">Manifest:</span> v{manifest.manifest_version}</div>
              <div class="col-span-2 sm:col-span-1"><span class="opacity-70">Action Badge:</span> <button class="btn btn-xs ml-2" onclick={() => setActionBadge('OK')}>Test</button></div>
            </div>
            <div class="divider"></div>
            <div class="alert">
              <span>Tip: This sidepanel is intentionally generic. Pick sections you want and delete the rest.</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Toasts -->
  <div class="toast toast-end">
    {#each toasts as t (t.id)}
      <div class="alert alert-{t.type} max-w-xs">
        <span class="truncate">{t.message}</span>
        <button class="btn btn-ghost btn-xs ml-2" onclick={() => (toasts = toasts.filter((x) => x.id !== t.id))}>Dismiss</button>
      </div>
    {/each}
    {#if toasts.length > 1}
      <button class="btn btn-ghost btn-xs" onclick={clearToasts}>Clear all</button>
    {/if}
  </div>
</div>
