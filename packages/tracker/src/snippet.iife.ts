import { initFromScript } from "./snippet.js";

// Self-executing entry for the copy-paste <script> tag. Also exposes the
// created tracker as window.unifeather so pages can send custom events.
declare global {
  interface Window {
    unifeather?: ReturnType<typeof initFromScript>;
  }
}

window.unifeather = initFromScript();
