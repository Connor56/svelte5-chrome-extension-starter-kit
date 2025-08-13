/// <reference types="svelte" />
/// <reference types="vite/client" />

// Explicit module declaration to satisfy TypeScript for `.svelte` imports.
declare module "*.svelte" {
  import type { SvelteComponentTyped } from "svelte";
  export default SvelteComponentTyped<any, any, any>;
}
