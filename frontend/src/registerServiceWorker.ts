/**
 * Registers the offline-page service worker once the page has loaded. Only in production builds,
 * so the dev server and tests never run one.
 * @param {boolean} [enabled] defaults to production builds, overridable for tests
 */
export function registerServiceWorker(enabled = import.meta.env.PROD) {
  if (!enabled || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("service worker registration failed", error);
    });
  });
}
