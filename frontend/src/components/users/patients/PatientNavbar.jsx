import {
  Bell,
  ChevronDown,
  X,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PackagePlus,
  Pill,
  Send,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import logo from '../../../assets/logo.png'
import mockProfile from '../../../assets/mock-profile.png'
import HeaderSearch from '../shared/HeaderSearch'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#patient-dashboard' },
  {
    label: 'Referral',
    icon: Send,
    children: [
      { label: 'Current Referral', icon: Send, href: '#current-referral' },
      { label: 'Past Referral', icon: FileText, href: '#past-referral' },
    ],
  },
  {
    label: 'Medicine',
    icon: Pill,
    children: [
      { label: 'Request Medicine', icon: PackagePlus, href: '#medicine-request' },
    ],
  },
  {
    label: 'Setting',
    icon: Settings,
    children: [
      { label: 'Change Password', icon: LockKeyhole, href: '#change-password' },
      { label: 'Change Active Status', icon: ShieldCheck, href: '#active-status' },
    ],
  },
]

function PatientNavbar({
  sidebarOpen = true,
  onSidebarOpenChange,
  activePage = 'dashboard',
  currentUser,
  notifications = [],
  unreadCount = 0,
  onLogout,
  onOpenDashboard,
  onOpenCurrentReferral,
  onOpenPastReferral,
  onOpenMedicineRequest,
  onOpenSettings,
  onNotificationOpen,
  onViewAllNotifications = () => {},
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(() => navItems.filter((item) => item.children).map((item) => item.label))
  const pageByLabel = { Dashboard: 'dashboard', 'Current Referral': 'currentReferral', 'Past Referral': 'pastReferral', 'Request Medicine': 'medicineRequest', 'Change Password': 'settings', 'Change Active Status': 'settings' }
  const closeMenu = () => { setIsMenuOpen(false); setCollapsedGroups(navItems.filter((item) => item.children).map((item) => item.label)) }
  const patientName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || currentUser?.username || 'Patient'
  return (
    <header className="patient-header">
      <div className="patient-topnav">
        <a
          className="patient-brand"
          href="#patient-dashboard"
          aria-label="MediFLOW Patient Dashboard"
          onClick={(event) => {
            event.preventDefault()
            onOpenDashboard()
            closeMenu()
          }}
        >
          <img src={logo} alt="" />
          <span className="workspace-role-label">Patient</span>
        </a>

        <HeaderSearch role="patient" notifications={notifications} onNotificationOpen={onNotificationOpen}
          pages={[
            { label: 'Dashboard', onSelect: onOpenDashboard },
            { label: 'Current Referral', onSelect: onOpenCurrentReferral },
            { label: 'Past Referral', onSelect: onOpenPastReferral },
            { label: 'Request Medicine', onSelect: onOpenMedicineRequest },
            { label: 'Settings', onSelect: onOpenSettings, keywords: 'change password active login status account' },
            { label: 'Notifications', onSelect: onViewAllNotifications },
          ]} />
        <div className="patient-notification-wrap">
          <button className="patient-notification" type="button" aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && <span aria-hidden="true" />}
          </button>
          <div className="patient-notification-menu" role="menu">
            <header>
              <strong>Notifications</strong>
              <span>{unreadCount} new</span>
            </header>
            {notifications.length > 0 ? (
              notifications.slice(0, 8).map((notification) => (
                <button
                  className={notification.read ? '' : 'is-unread'}
                  type="button"
                  role="menuitem"
                  key={notification.id}
                  onClick={() => onNotificationOpen(notification)}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time>{new Date(notification.createdAt).toLocaleString()}</time>
                </button>
              ))
            ) : (
              <p>No notifications yet.</p>
            )}
            <button className="notification-view-all" type="button" onClick={onViewAllNotifications}>
              View all notifications
            </button>
          </div>
        </div>

        <button className="patient-profile" type="button" onClick={onOpenSettings}>
          <div className="patient-avatar">
            <img src={mockProfile} alt="" />
          </div>
          <div>
            <strong>{patientName}</strong>
            <span>online</span>
          </div>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>

      <nav id="patient-sidebar" className="patient-navbar" aria-label="Patient navigation"
      >
        <button
          className="patient-menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="patient-navigation"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <Menu size={18} />
          Menu
        </button>
        <button
          className={`mobile-nav-backdrop ${isMenuOpen ? 'is-open' : ''}`}
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMenuOpen(false)}
        />

        <ul className={`patient-nav-list ${isMenuOpen ? 'is-open' : ''}`} id="patient-navigation">
          <li className="mobile-sidebar-header">
            <span>Menu</span>
            <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
              <X size={18} />
            </button>
          </li>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li className={`${item.children ? 'has-dropdown' : ''} ${pageByLabel[item.label] === activePage ? 'is-active' : ''}`} key={item.label}>
                {item.label === 'Dashboard' ? (
                  <button type="button" title="Dashboard" onClick={() => { onOpenDashboard(); closeMenu() }}>
                    <Icon size={16} />
                    <span className="sidebar-item-label">{item.label}</span>
                  </button>
                ) : (
                  <button type="button" title={item.label} aria-expanded={sidebarOpen && !collapsedGroups.includes(item.label)} aria-controls={`patient-group-${item.label}`} onClick={() => { if (!sidebarOpen) { onSidebarOpenChange(true); setCollapsedGroups((current) => current.filter((label) => label !== item.label)) } else { setCollapsedGroups((current) => current.includes(item.label) ? current.filter((label) => label !== item.label) : [...current, item.label]) } }}>
                    <Icon size={16} />
                    <span className="sidebar-item-label">{item.label}</span>
                    {item.children && <ChevronDown className="nav-chevron" size={14} />}
                  </button>
                )}

                {item.children && (
                  <ul className="patient-dropdown" id={`patient-group-${item.label}`} hidden={collapsedGroups.includes(item.label)}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <li key={child.label} className={pageByLabel[child.label] === activePage ? 'is-active' : ''}>
                          {child.label === 'Current Referral' ? (
                            <button type="button" onClick={() => { onOpenCurrentReferral(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Past Referral' ? (
                            <button type="button" onClick={() => { onOpenPastReferral(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Request Medicine' ? (
                            <button type="button" onClick={() => { onOpenMedicineRequest(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Change Password' || child.label === 'Change Active Status' ? (
                            <button type="button" onClick={() => { onOpenSettings(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.action === 'logout' ? (
                            <button className="logout-action" type="button" onClick={() => { onLogout(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : (
                            <a href={child.href}>
                              <ChildIcon size={15} />
                              {child.label}
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
          <li className="sidebar-logout">
            <button type="button" title="Logout" onClick={() => { onLogout(); closeMenu() }}>
              <LogOut size={17} /><span className="sidebar-item-label">Logout</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>
  )
}

export default PatientNavbar
