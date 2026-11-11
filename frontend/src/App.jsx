import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Heropage from './components/Heropage'
import Tutorial from './components/Tutorial'
import Services from './components/Services'
import FAQ from './components/FAQ'
import Testimonials from './components/Testimonials'
import Feedback from './components/Feedback'
import Link from './components/Link'
import Login from './components/Login'
import InstallPwaButton from './components/InstallPwaButton'
import BHCDashboard from './components/users/bhc/BHCDashboard'
import CHODashboard from './components/users/cho/CHODashboard'
import DocDashboard from './components/users/doctor/DocDashboard'
import PatientReferral from './components/users/patients/PatientReferral'
import OPDDashboard from './components/users/opd/OPDDashboard'
import PharmacistDashboard from './components/users/pharmacist/PharmacistDashboard'
import { clearSession, getAccessToken, getStoredUser, SESSION_EXPIRED_EVENT } from './services/authUser'
import { sendHeartbeat } from './services/users'
import './App.css'
import './components/users/shared/SidebarNavigation.css'

function App() {
  const getInitialPage = () => {
    if (!getAccessToken() || !localStorage.getItem('user')) return 'landing'
    const user = getStoredUser()
    if (!user) clearSession()
    return user?.role || 'landing'
  }

  const [page, setPage] = useState(getInitialPage)

  useEffect(() => {
    const dashboardPages = ['bhc', 'cho', 'opd', 'pharmacist', 'doctor', 'patient']

    if (!dashboardPages.includes(page) || !getAccessToken()) return undefined

    const heartbeat = () => {
      sendHeartbeat().catch(() => {})
    }

    heartbeat()
    const intervalId = window.setInterval(heartbeat, 20000)

    return () => window.clearInterval(intervalId)
  }, [page])

  useEffect(() => {
    const handleSessionExpired = () => {
      setPage('login')
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [])

  const handleLogout = () => {
    clearSession()
    setPage('login')
  }

  if (page === 'login') {
    return (
      <div className="app">
        <InstallPwaButton />
        <Login onBackHome={() => setPage('landing')} onLogin={(role) => setPage(role)} />
      </div>
    )
  }

  if (page === 'bhc') {
    return (
      <>
        <InstallPwaButton />
        <BHCDashboard onLogout={handleLogout} />
      </>
    )
  }

  if (page === 'cho') {
    return (
      <>
        <InstallPwaButton />
        <CHODashboard onLogout={handleLogout} />
      </>
    )
  }

  if (page === 'opd') {
    return <><InstallPwaButton /><OPDDashboard onLogout={handleLogout} /></>
  }

  if (page === 'pharmacist') {
    return <><InstallPwaButton /><PharmacistDashboard onLogout={handleLogout} /></>
  }

  if (page === 'doctor') {
    return (
      <>
        <InstallPwaButton />
        <DocDashboard onLogout={handleLogout} />
      </>
    )
  }

  if (page === 'patient') {
    return (
      <>
        <InstallPwaButton />
        <PatientReferral onLogout={handleLogout} />
      </>
    )
  }

  return (
    <div className="app">
      <InstallPwaButton />
      <Navbar />
      <main id="home" className="landing">
        <Heropage onGetStarted={() => setPage('login')} />
        <Tutorial />
        <Services />
        <FAQ />
        <Testimonials />
        <Feedback />
      </main>
      <Link />
    </div>
  )
}

export default App
