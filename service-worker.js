const CACHE_NAME = "sams-shell-v1";
self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
// SAMS remains online-first. The service worker is intentionally minimal so
// Supabase authentication and live assessment data are never cached locally.
