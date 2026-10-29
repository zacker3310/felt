/* felt service worker: makes the game installable and playable offline (airplane mode too).
   Precaches the page, the manifest, the icons and the launch images. A navigation goes to the network first so a
   new deploy reaches players, but gives up after NAV_TIMEOUT_MS and answers from the cache.
   Every other same-origin GET is cache-first. Nothing beyond the origin is ever fetched or
   cached. Bump VERSION when the precache list changes; activate deletes every older cache. */
'use strict';
const VERSION = 'felt-v4';
const NAV_TIMEOUT_MS = 2500;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  /* launch:begin */
  './icons/launch/launch-750x1334.png',
  './icons/launch/launch-1334x750.png',
  './icons/launch/launch-1242x2208.png',
  './icons/launch/launch-2208x1242.png',
  './icons/launch/launch-1125x2436.png',
  './icons/launch/launch-2436x1125.png',
  './icons/launch/launch-828x1792.png',
  './icons/launch/launch-1792x828.png',
  './icons/launch/launch-1242x2688.png',
  './icons/launch/launch-2688x1242.png',
  './icons/launch/launch-1170x2532.png',
  './icons/launch/launch-2532x1170.png',
  './icons/launch/launch-1284x2778.png',
  './icons/launch/launch-2778x1284.png',
  './icons/launch/launch-1179x2556.png',
  './icons/launch/launch-2556x1179.png',
  './icons/launch/launch-1290x2796.png',
  './icons/launch/launch-2796x1290.png',
  './icons/launch/launch-1206x2622.png',
  './icons/launch/launch-2622x1206.png',
  './icons/launch/launch-1260x2736.png',
  './icons/launch/launch-2736x1260.png',
  './icons/launch/launch-1320x2868.png',
  './icons/launch/launch-2868x1320.png',
  /* launch:end */
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('felt-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* the network, but no longer than ms: rejects on a timeout or a network error */
function fetchWithin(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

async function navigate(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetchWithin(req, NAV_TIMEOUT_MS);
    if (!res.ok) throw new Error('status ' + res.status);
    /* keep the newest page under both names the precache uses */
    const copy = res.clone();
    await Promise.all([cache.put('./index.html', copy.clone()), cache.put('./', copy)]);
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(req.mode === 'navigate' ? navigate(req) : cacheFirst(req));
});
