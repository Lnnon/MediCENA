import {
  Bell,
  CalendarCheck,
  ChevronDown,
  X,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Send,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import logo from '../../../assets/logo.png'
import mockProfile from '../../../assets/mock-profile.png'
import HeaderSearch from '../shared/HeaderSearch'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#doctor-dashboard' },
  {
    label: 'Patient',
    icon: Users,
    children: [
      { label: 'Patient List', icon: ClipboardList, href: '#patient-list' },
    ],
  },
  { label: 'Referral', icon: Send, href: '#doctor-referral' },
  { label: 'Consultation', icon: CalendarCheck, href: '#consultation' },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Change Password', icon: LockKeyhole, href: '#change-password' },
      { label: 'Change Active Status', icon: ShieldCheck, href: '#active-status' },
    ],
  },
]

function DocNavbar({
  currentUser,
  onLogout,
  onOpenDashboard,
  onOpenPatients,
  onOpenReferrals,
  onOpenConsultation,
  onOpenSettings,
  referralNewCount = 0,
  notifications = [],
  unreadCount = 0,
  onNotificationOpen = () => {},
  onViewAllNotifications = () => {},
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState([])
  const closeMenu = () => { setIsMenuOpen(false); setOpenGroups([]) }
  const doctorName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || currentUser?.username || 'Doctor'

  return (
    <header className="doc-header">
      <div className="doc-topnav">
        <button className="doc-brand" type="button" aria-label="MediFLOW Doctor Dashboard" onClick={onOpenDashboard}>
          <img src={logo} alt="" />
          <span className="workspace-role-label">Doctor</span>
        </button>

        <HeaderSearch role="doctor" notifications={notifications} onNotificationOpen={onNotificationOpen}
          pages={[
            { label: 'Dashboard', onSelect: onOpenDashboard },
            { label: 'Patient List', onSelect: onOpenPatients },
            { label: 'Referrals', onSelect: onOpenReferrals },
            { label: 'Consultation', onSelect: onOpenConsultation },
            { label: 'Settings', onSelect: onOpenSettings, keywords: 'change password active login status account' },
            { label: 'Notifications', onSelect: onViewAllNotifications },
          ]} />
        <div className="doc-notification-wrap">
          <button className="doc-notification" type="button" aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && <span aria-hidden="true" />}
          </button>
          <div className="doc-notification-menu" role="menu">
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

        <div className="doc-profile">
          <div className="doc-avatar">
            <img src={mockProfile} alt="" />
          </div>
          <div>
            <strong>{doctorName}</strong>
            <span>online</span>
          </div>
        </div>
      </div>

      <nav className="doc-navbar" aria-label="Doctor navigation">
        <button
          className="doc-menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="doctor-navigation"
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

        <ul className={`doc-nav-list ${isMenuOpen ? 'is-open' : ''}`} id="doctor-navigation">
          <li className="mobile-sidebar-header">
            <span>Menu</span>
            <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
              <X size={18} />
            </button>
          </li>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li className={item.children ? 'has-dropdown' : ''} key={item.label}>
                {item.label === 'Dashboard' ? (
                  <button type="button" onClick={() => { onOpenDashboard(); closeMenu() }}>
                    <Icon size={16} aria-label={item.label} />
                    <span className="medical-nav-label">{item.label}</span>
                  </button>
                ) : item.label === 'Referral' ? (
                  <button type="button" onClick={() => { onOpenReferrals(); closeMenu() }}>
                    <Icon size={16} aria-label={item.label} />
                    <span className="medical-nav-label">{item.label}</span>
                    {referralNewCount > 0 && (
                      <span className="doc-nav-badge">{referralNewCount} New</span>
                    )}
                  </button>
                ) : item.label === 'Consultation' ? (
                  <button type="button" onClick={() => { onOpenConsultation(); closeMenu() }}>
                    <Icon size={16} aria-label={item.label} />
                    <span className="medical-nav-label">{item.label}</span>
                  </button>
                ) : (
                  <button type="button" aria-expanded={openGroups.includes(item.label)} aria-controls={`doc-group-${item.label.replaceAll(' ', '-')}`} onClick={() => setOpenGroups((current) => current.includes(item.label) ? current.filter((label) => label !== item.label) : [...current, item.label])}>
                    <Icon size={16} aria-label={item.label} />
                    <span className="medical-nav-label">{item.label}</span>
                    {item.children && <ChevronDown className="nav-chevron" size={14} />}
                  </button>
                )}

                {item.children && (
                  <ul className="doc-dropdown" id={`doc-group-${item.label.replaceAll(' ', '-')}`} hidden={!openGroups.includes(item.label)}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <li key={child.label}>
                          {child.label === 'Patient List' ? (
                            <button type="button" onClick={() => { onOpenPatients(); closeMenu() }}>
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
          <li className="medical-sidebar-logout"><button type="button" title="Logout" onClick={() => { onLogout(); closeMenu() }}><LogOut size={17} /><span className="medical-nav-label">Logout</span></button></li>
        </ul>
      </nav>
    </header>
  )
}

export default DocNavbar


