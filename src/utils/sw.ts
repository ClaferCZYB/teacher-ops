export function registerSW() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  // 只在生产构建时启用（避免 dev 缓存导致刷新生效失败）
  if (import.meta.env.DEV) return
  window.addEventListener('load', () => {
    const url = new URL('sw.js', window.location.href).toString()
    navigator.serviceWorker
      .register(url, { scope: './' })
      .catch((err) => {
        // 不阻塞主流程
        console.warn('SW registration failed', err)
      })
  })
}
