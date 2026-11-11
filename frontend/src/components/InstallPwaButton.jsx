import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

function InstallPwaButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
      setIsInstalled(false)
    }

    const handleInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }

    setInstallPrompt(null)
  }

  if (!installPrompt || isInstalled) return null

  return (
    <button className="pwa-install-button" type="button" onClick={handleInstall}>
      <Download size={16} />
      Install App
    </button>
  )
}

export default InstallPwaButton
