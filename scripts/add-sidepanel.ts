import { program } from "commander";
import fs from "fs";

function addSidepanel() {
  if (sidepanelExists()) {
    console.log("Skipping sidepanel addition.");
    return;
  }

  const sidepanelIndexPath = "src/sidepanel/index.html";
  const sidepanelMainPath = "src/sidepanel/main.ts";
  const sidepanelAppPath = "src/sidepanel/App.svelte";

  fs.writeFileSync(sidepanelIndexPath, defaultSidepanelIndex());
  fs.writeFileSync(sidepanelMainPath, defaultSidepanelMain());
  fs.writeFileSync(sidepanelAppPath, defaultSidepanelApp());

  console.log("Sidepanel added");
}

/**
 * Checks if a sidepanel already exists in the project, as there can only be one.
 * @returns true if the sidepanel exists, false otherwise.
 * @throws an error if the sidepanel is in an unexpected state.
 */
function sidepanelExists() {
  const sidepanelIndexPath = "src/sidepanel/index.html";
  const sidepanelMainPath = "src/sidepanel/main.ts";
  const sidepanelAppPath = "src/sidepanel/App.svelte";

  const sidepanelIndexExists = fs.existsSync(sidepanelIndexPath);
  const sidepanelMainExists = fs.existsSync(sidepanelMainPath);
  const sidepanelAppExists = fs.existsSync(sidepanelAppPath);

  const allExist =
    sidepanelIndexExists && sidepanelMainExists && sidepanelAppExists;
  const noneExist =
    !sidepanelIndexExists && !sidepanelMainExists && !sidepanelAppExists;

  if (allExist) {
    console.log("Sidepanel already exists");
    return true;
  }

  if (noneExist) {
    console.log("Sidepanel does not exist");
    return false;
  }

  const invalidSidepanelStateMessage = `Sidepanel state is unexpected:\n\
    - index.html: ${sidepanelIndexExists}\n\
    - main.ts: ${sidepanelMainExists}\n\
    - App.svelte: ${sidepanelAppExists}`;

  throw new Error(invalidSidepanelStateMessage);
}

function defaultSidepanelIndex() {
  return `<div id="app"></div>
<script type="module" src="/src/sidepanel/main.ts"></script>`;
}

function defaultSidepanelMain() {
  return `import "../app.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });`;
}

function defaultSidepanelApp() {
  return `<div class="h-screen bg-base-100">
  <div class="flex h-full">
    This is the sidepanel.
  </div>
</div>`;
}

addSidepanel();
