export default function pollWhileVisible(load, intervalMs) {
  let pending = false

  const poll = async () => {
    if (document.hidden || pending) return
    pending = true
    try {
      await load()
    } finally {
      pending = false
    }
  }

  const timer = window.setInterval(poll, intervalMs)
  document.addEventListener('visibilitychange', poll)
  void poll()

  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', poll)
  }
}
