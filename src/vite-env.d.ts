/// <reference types="svelte" />
/// <reference types="vite/client" />

// Explicit module declaration to satisfy TypeScript for `.svelte` imports.
declare module "*.svelte" {
  import type { SvelteComponentTyped } from "svelte";
  export default SvelteComponentTyped<any, any, any>;
}

// Provide a lightweight ambient declaration for Chrome MV3 APIs to satisfy TS.
// If you install `chrome-types`, you can replace this with:
// /// <reference types="chrome-types" />
declare const chrome: any;
