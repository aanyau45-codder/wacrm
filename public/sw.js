// Argon CRM service worker — offline screen + task reminders. Pages always come from
// the network; when that fails (no internet), show offline.html instead
// of the browser's error page. Nothing else is cached, so the app never
// serves stale data. Bump VERSION when offline.html changes.
const VERSION = 'offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  // Leave file downloads (the app update APK) and API calls to the
  // browser: answering them from here broke downloads in the Android app.
  const path = new URL(event.request.url).pathname
  if (path.startsWith('/downloads/') || path.startsWith('/api/')) return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((res) => res || Response.error()),
    ),
  )
})

// Task reminders and the morning summary (Web Push from /api/tasks/cron).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Argon CRM', body: event.data ? event.data.text() : '' }
  }
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    tag: data.tag,
    renotify: !!data.tag,
    requireInteraction: !!data.taskId,
    data: { url: data.url || '/tasks', taskId: data.taskId || null },
  }
  if (data.taskId) {
    options.actions = [
      { action: 'done', title: 'Done' },
      { action: 'snooze', title: 'Snooze 15 min' },
    ]
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Argon CRM', options))
})

self.addEventListener('notificationclick', (event) => {
  const { url, taskId } = event.notification.data || {}
  event.notification.close()

  if (taskId && (event.action === 'done' || event.action === 'snooze')) {
    event.waitUntil(
      fetch('/api/tasks/' + taskId, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: event.action }),
      }).then((res) => {
        // Signed out or failed: open the task so it can be handled there.
        if (!res.ok) return openUrl(url)
      }, () => openUrl(url)),
    )
    return
  }
  event.waitUntil(openUrl(url || '/tasks'))
})

function openUrl(url) {
  const target = new URL(url || '/tasks', self.location.origin).href
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : c))
      }
    }
    return self.clients.openWindow(target)
  })
}
