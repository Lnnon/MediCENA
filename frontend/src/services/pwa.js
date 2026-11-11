export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      await Promise.all(registrations.map((registration) => registration.unregister()))
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      }
    })
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA registration should not block the health workflow if the browser refuses it.
    })
  })
}
