import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  X,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Map,
  Menu,
  PackagePlus,
  PackageCheck,
  Settings,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import logo from '../../../assets/logo.png'
import mockProfile from '../../../assets/mock-profile.png'
import HeaderSearch from '../shared/HeaderSearch'

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '#bhc-dashboard',
  },
  {
    label: 'Patients',
    icon: Users,
    children: [
      { label: 'List of Patients', icon: ClipboardList, href: '#patients-list' },
      { label: 'Track Patients', icon: Activity, href: '#track-patients' },
    ],
  },
  {
    label: 'Referral',
    icon: Send,
    children: [
      { label: 'Referred Patients', icon: UserCheck, href: '#referred-patients' },
    ],
  },
  {
    label: 'Medicine',
    icon: Boxes,
    children: [
      { label: 'Inventory', icon: Boxes, href: '#medicine-inventory' },
      { label: 'Request', icon: PackagePlus, href: '#medicine-request' },
      { label: 'Distribution', icon: PackageCheck, href: '#medicine-distribution' }
    ],
  },
  {
    label: 'Monitoring',
    icon: BarChart3,
    children: [
      { label: 'HealthMap', icon: Map, href: '#healthmap' },
      { label: 'Analytics', icon: BarChart3, href: '#analytics' },
      { label: 'Reports', icon: FileText, href: '#reports' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Change Password', icon: LockKeyhole, href: '#change-password' },
      { label: 'Change Login Status', icon: ShieldCheck, href: '#login-status' },
    ],
  },
]

function BHCNavbar({
  currentUserName,
  notifications = [],
  unreadCount = 0,
  onOpenDashboard,
  onOpenPatients,
  onOpenTrackPatients,
  onOpenReferred,
  onOpenInventory,
  onOpenMedicineDistribution,
  onOpenMedicineRequests,
  onOpenHealthMap,
  onOpenAnalytics,
  onOpenReports,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  onNotificationOpen,
  onViewAllNotifications = () => {},
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState([])
  const closeMenu = () => { setIsMenuOpen(false); setOpenGroups([]) }

  return (
    <header className="bhc-header">
      <div className="bhc-topnav">
        <button className="bhc-brand" type="button" aria-label="MediFLOW BHC Dashboard" onClick={onOpenDashboard}>
          <img src={logo} alt="" />
          <span className="workspace-role-label">BHC</span>
        </button>

        <HeaderSearch role="bhc" notifications={notifications} onNotificationOpen={onNotificationOpen}
          pages={[
            { label: 'Dashboard', onSelect: onOpenDashboard },
            { label: 'List of Patients', onSelect: onOpenPatients, keywords: 'patient list registration' },
            { label: 'Track Patients', onSelect: onOpenTrackPatients },
            { label: 'Medicine Inventory', onSelect: onOpenInventory },
            { label: 'Referred Patients', onSelect: onOpenReferred },
            { label: 'Medicine Distribution', onSelect: onOpenMedicineDistribution },
            { label: 'Medicine Requests', onSelect: onOpenMedicineRequests, keywords: 'request delivery' },
            { label: 'HealthMap', onSelect: onOpenHealthMap, keywords: 'health map gis disease purok barangay' },
            { label: 'Analytics', onSelect: onOpenAnalytics, keywords: 'outbreak disease monitoring' },
            { label: 'Reports', onSelect: onOpenReports, keywords: 'generate export csv print' },
            { label: 'Profile', onSelect: onOpenProfile },
            { label: 'Settings', onSelect: onOpenSettings, keywords: 'change password active login status account' },
            { label: 'Notifications', onSelect: onViewAllNotifications },
          ]} />
        <div className="bhc-notification-wrap">
          <button className="bhc-notification" type="button" aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && <span aria-hidden="true" />}
          </button>
          <div className="bhc-notification-menu" role="menu">
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

        <button className="bhc-profile" type="button" onClick={onOpenProfile}>
          <div className="bhc-avatar">
            <img src={mockProfile} alt="" />
          </div>
          <div>
            <strong>{currentUserName}</strong>
            <span>online</span>
          </div>
        </button>
      </div>

      <nav className="bhc-navbar" aria-label="BHC navigation">
        <button
          className="bhc-menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="bhc-navigation"
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

        <ul className={`bhc-nav-list ${isMenuOpen ? 'is-open' : ''}`} id="bhc-navigation">
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
                ) : (
                  <button type="button" aria-expanded={openGroups.includes(item.label)} aria-controls={`bhc-group-${item.label.replaceAll(' ', '-')}`} onClick={() => setOpenGroups((current) => current.includes(item.label) ? current.filter((label) => label !== item.label) : [...current, item.label])}>
                    <Icon size={16} aria-label={item.label} />
                    <span className="medical-nav-label">{item.label}</span>
                    {item.children && <ChevronDown className="nav-chevron" size={14} />}
                  </button>
                )}

                {item.children && (
                  <ul className="bhc-dropdown" id={`bhc-group-${item.label.replaceAll(' ', '-')}`} hidden={!openGroups.includes(item.label)}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <li key={child.label}>
                          {child.label === 'List of Patients' ? (
                            <button type="button" onClick={() => { onOpenPatients(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Track Patients' ? (
                            <button type="button" onClick={() => { onOpenTrackPatients(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Referred Patients' ? (
                            <button type="button" onClick={() => { onOpenReferred(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Inventory' ? (
                            <button type="button" onClick={() => { onOpenInventory(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Distribution' ? (
                            <button type="button" onClick={() => { onOpenMedicineDistribution(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Request' ? (
                            <button type="button" onClick={() => { onOpenMedicineRequests(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'HealthMap' ? (
                            <button type="button" onClick={() => { onOpenHealthMap(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Analytics' ? (
                            <button type="button" onClick={() => { onOpenAnalytics(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Reports' ? (
                            <button type="button" onClick={() => { onOpenReports(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Change Password' || child.label === 'Change Login Status' ? (
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

export default BHCNavbar
