// Minimal service worker: intentionally does not cache API or application responses.
// This prevents stale login pages or cached API responses during deployment.
self.addEventListener("install", (event) => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
