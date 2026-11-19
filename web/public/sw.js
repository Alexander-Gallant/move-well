const CACHE_PREFIX = 'move-well-'
const CACHE_VERSION = 'v4'
const PRECACHE_CACHE_NAME = `${CACHE_PREFIX}precache-${CACHE_VERSION}`
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`
const CURRENT_CACHE_NAMES = [PRECACHE_CACHE_NAME, RUNTIME_CACHE_NAME]
const PRECACHE_SHELL_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icons.svg',
]
const STATIC_DESTINATIONS = new Set([
  'document',
  'font',
  'image',
  'manifest',
  'script',
  'style',
  'worker',
])
const STATIC_EXTENSIONS = new Set([
  '.css',
  '.gif',
  '.html',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.map',
  '.png',
  '.svg',
  '.ttf',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
])

const getScopedUrl = (path) => new URL(path, self.registration.scope).toString()

const isCacheableResponse = (response) => response.ok || response.type === 'opaque'

const isCacheableRequest = (request) => {
  if (request.method !== 'GET' || !STATIC_DESTINATIONS.has(request.destination)) return false

  const url = new URL(request.url)
  return (
    url.origin === self.location.origin &&
    url.protocol === self.location.protocol &&
    url.search === ''
  )
}

const isSafeStaticUrl = (value) => {
  const url = value instanceof URL ? value : new URL(value)
  const scope = new URL(self.registration.scope)
  const extension = url.pathname.slice(url.pathname.lastIndexOf('.')).toLowerCase()

  return (
    url.origin === self.location.origin
    && url.protocol === self.location.protocol
    && url.search === ''
    && url.hash === ''
    && url.pathname.startsWith(scope.pathname)
    && STATIC_EXTENSIONS.has(extension)
  )
}

const getCachedResponse = async (request) => {
  try {
    return await caches.match(request)
  } catch {
    return undefined
  }
}

const extractStaticAssetUrls = (html, indexUrl) => {
  const assets = new Set()
  const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi
  let match

  while ((match = attributePattern.exec(html)) !== null) {
    try {
      const assetUrl = new URL(match[1], indexUrl)
      if (isSafeStaticUrl(assetUrl)) assets.add(assetUrl.toString())
    } catch {
      // Ignore malformed or unsupported references from the document.
    }
  }

  return [...assets]
}

const precacheAppShell = async () => {
  const cache = await caches.open(PRECACHE_CACHE_NAME)
  const indexUrl = getScopedUrl('./index.html')

  // A missing optional asset must not prevent the worker from installing.
  await Promise.allSettled(
    PRECACHE_SHELL_PATHS.map((path) => cache.add(new Request(getScopedUrl(path), { cache: 'reload' }))),
  )

  let indexResponse
  try {
    indexResponse = await fetch(new Request(indexUrl, { cache: 'reload' }))
  } catch {
    indexResponse = await getCachedResponse(indexUrl)
  }

  if (!indexResponse || !isCacheableResponse(indexResponse)) return

  try {
    await cache.put(indexUrl, indexResponse.clone())
    const html = await indexResponse.text()
    await Promise.allSettled(
      extractStaticAssetUrls(html, indexUrl)
        .map((url) => cache.add(new Request(url, { cache: 'reload' }))),
    )
  } catch {
    // A malformed shell response or storage failure should not block activation.
  }
}

const removeStaleCaches = async () => {
  const cacheNames = await caches.keys()
  const staleCacheNames = cacheNames.filter(
    (cacheName) => cacheName.startsWith(CACHE_PREFIX) && !CURRENT_CACHE_NAMES.includes(cacheName),
  )

  await Promise.all(staleCacheNames.map((cacheName) => caches.delete(cacheName)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    removeStaleCaches()
      .catch(() => undefined)
      .then(() => self.clients.claim()),
  )
})

const fetchAndCacheStaticResource = async (request) => {
  try {
    const networkResponse = await fetch(request)

    if (isCacheableResponse(networkResponse)) {
      try {
        const cache = await caches.open(RUNTIME_CACHE_NAME)
        await cache.put(request, networkResponse.clone())
      } catch {
        // Storage failures should not hide a valid network response.
      }
    }

    return networkResponse
  } catch {
    const cachedResponse = await getCachedResponse(request)
    if (cachedResponse) return cachedResponse

    if (request.mode === 'navigate') {
      const shellResponse = await getCachedResponse(getScopedUrl('./index.html'))
      if (shellResponse) return shellResponse
    }

    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  if (!isCacheableRequest(event.request)) return

  event.respondWith(
    getCachedResponse(event.request).then(
      (cachedResponse) => cachedResponse ?? fetchAndCacheStaticResource(event.request),
    ),
  )
})
