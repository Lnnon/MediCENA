const CACHE_VERSION = 'mediflow-pwa-v2'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-icon.svg',
]

const isPrivateRequest = (request) => {
  try {
    const url = new URL(request.url)
    return url.pathname.includes('/api/') || url.pathname.includes('/media/')
  } catch {
    return false
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_VERSION).map((cacheName) => caches.delete(cacheName))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET' || isPrivateRequest(request)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/') || caches.match(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }

        const copy = response.clone()
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
        return response
      })
    }),
  )
})
