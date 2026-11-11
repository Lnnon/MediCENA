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
  PackageCheck,
  Send,
  Settings,
  ShieldCheck,
  Truck,
  UserCheck,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react'
import { useState } from 'react'
import logo from '../../../assets/logo.png'
import mockProfile from '../../../assets/mock-profile.png'
import HeaderSearch from '../shared/HeaderSearch'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#cho-dashboard' },
  {
    label: 'Patient',
    icon: Users,
    children: [
      { label: 'List of Patients', icon: ClipboardList, href: '#cho-patients' },
      { label: 'Track Patients', icon: Activity, href: '#track-patients' },
    ],
  },
  {
    label: 'Referral',
    icon: Send,
    children: [
      { label: 'Referral Monitoring', icon: Truck, href: '#incoming-referrals' },
      { label: 'Doctor Assignments', icon: UserCheck, href: '#referred-patients' },
    ],
  },
  {
    label: 'Medicine',
    icon: Boxes,
    children: [
      { label: 'Stock', icon: PackageCheck, href: '#medicine-inventory' },
      { label: 'Request & Delivery', icon: ClipboardList, href: '#medicine-requests' },
      { label: 'Patient Distributions', icon: Truck, href: '#patient-distributions' },
    ],
  },
  {
    label: 'Monitoring',
    icon: BarChart3,
    children: [
      { label: 'HealthMap', icon: Map, href: '#healthmap' },
      { label: 'Analytics', icon: BarChart3, href: '#analytics' },
      { label: 'Predictive Analytics', icon: Activity, href: '#predictive-analytics' },
      { label: 'Reports', icon: FileText, href: '#reports' },
    ],
  },
  {
    label: 'Staff & Users',
    icon: UserCog,
    children: [
      { label: "Who's Online?", icon: Wifi, href: '#online-users' },
      { label: 'Manage Users', icon: Users, href: '#users-list' },
      { label: 'Personnel Activity', icon: Activity, href: '#personnel-activity' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Change Password', icon: LockKeyhole, href: '#change-password' },
      { label: 'Change Active Status', icon: ShieldCheck, href: '#active-status' },
    ],
  },
]

function CHONavbar({
  sidebarOpen = true,
  onSidebarOpenChange,
  onLogout,
  currentUserName,
  notifications = [],
  unreadCount = 0,
  onOpenDashboard,
  onOpenPatients,
  onOpenTrackPatients,
  onOpenIncoming,
  onOpenReferred,
  onOpenMedicineRequests,
  onOpenDistribution,
  onOpenPatientDistributions,
  onOpenHealthMap,
  onOpenAnalytics,
  onOpenPredictiveAnalytics,
  onOpenReports,
  onOpenProfile,
  onOpenOnlineUsers,
  onOpenActivity,
  onOpenManageUsers,
  onOpenSettings,
  onNotificationOpen,
  onViewAllNotifications = () => {},
  medicineNewCount = 0,
  referralNewCount = 0,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(() => navItems.filter((item) => item.children).map((item) => item.label))
  const closeMenu = () => { setIsMenuOpen(false); setCollapsedGroups(navItems.filter((item) => item.children).map((item) => item.label)) }

  const getNavBadgeCount = (label) => {
    if (label === 'Medicine Oversight') return medicineNewCount
    if (label === 'Referral Oversight') return referralNewCount
    return 0
  }

  return (
    <header className="cho-header">
      <div className="cho-topnav">
        <button className="cho-brand" type="button" aria-label="MediFLOW CHO Dashboard" onClick={onOpenDashboard}>
          <img src={logo} alt="" />
          <span className="workspace-role-label">CHO</span>
        </button>

        <HeaderSearch role="cho" notifications={notifications} onNotificationOpen={onNotificationOpen}
          pages={[
            { label: 'List of Patients', onSelect: onOpenPatients, keywords: 'patient list registration' },
            { label: 'Track Patients', onSelect: onOpenTrackPatients },
            { label: 'Referral Monitoring', onSelect: onOpenIncoming },
            { label: 'Medicine Stock', onSelect: onOpenDistribution },
            { label: 'Request & Delivery', onSelect: onOpenMedicineRequests },
            { label: 'Analytics', onSelect: onOpenAnalytics, keywords: 'outbreak disease monitoring' },
            { label: 'HealthMap', onSelect: onOpenHealthMap, keywords: 'health map gis disease purok barangay' },
            { label: 'Reports', onSelect: onOpenReports, keywords: 'generate export csv print' },
            { label: 'Manage Users', onSelect: onOpenManageUsers },
            { label: 'Dashboard', onSelect: onOpenDashboard },
            { label: 'Doctor Assignments', onSelect: onOpenReferred },
            { label: 'Patient Distributions', onSelect: onOpenPatientDistributions },
            { label: 'Predictive Analytics', onSelect: onOpenPredictiveAnalytics },
            { label: 'Online Users', onSelect: onOpenOnlineUsers, keywords: 'who is online' },
            { label: 'Personnel Activity', onSelect: onOpenActivity },
            { label: 'Profile', onSelect: onOpenProfile },
            { label: 'Settings', onSelect: onOpenSettings, keywords: 'change password active login status account' },
            { label: 'Notifications', onSelect: onViewAllNotifications },
          ]} />
        <div className="cho-notification-wrap">
          <button className="cho-notification" type="button" aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && <span aria-hidden="true" />}
          </button>
          <div className="cho-notification-menu" role="menu">
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

        <button className="cho-profile" type="button" onClick={onOpenProfile}>
          <div className="cho-avatar">
            <img src={mockProfile} alt="" />
          </div>
          <div>
            <strong>{currentUserName}</strong>
            <span>online</span>
          </div>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>

      <nav id="cho-sidebar" className="cho-navbar" aria-label="CHO navigation"
      >
        <button
          className="cho-menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="cho-navigation"
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

        <ul className={`cho-nav-list ${isMenuOpen ? 'is-open' : ''}`} id="cho-navigation">
          <li className="mobile-sidebar-header">
            <span>Menu</span>
            <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
              <X size={18} />
            </button>
          </li>
          {navItems.map((item) => {
            const Icon = item.icon
            const badgeCount = getNavBadgeCount(item.label)

            return (
              <li className={item.children ? 'has-dropdown' : ''} key={item.label}>
                {item.label === 'Dashboard' ? (
                  <button type="button" title="Dashboard" onClick={() => { onOpenDashboard(); closeMenu() }}>
                    <Icon size={16} />
                    <span className="sidebar-item-label">{item.label}</span>
                  </button>
                ) : (
                  <button type="button" title={item.label} aria-expanded={sidebarOpen && !collapsedGroups.includes(item.label)} aria-controls={`cho-group-${item.label.replaceAll(' ', '-')}`} onClick={() => { if (!sidebarOpen) { onSidebarOpenChange(true); setCollapsedGroups((current) => current.filter((label) => label !== item.label)) } else { setCollapsedGroups((current) => current.includes(item.label) ? current.filter((label) => label !== item.label) : [...current, item.label]) } }}>
                    <Icon size={16} />
                    <span className="sidebar-item-label">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="cho-nav-badge">{badgeCount} New</span>
                    )}
                    {item.children && <ChevronDown className="nav-chevron" size={14} />}
                  </button>
                )}

                {item.children && (
                  <ul className="cho-dropdown" id={`cho-group-${item.label.replaceAll(' ', '-')}`} hidden={collapsedGroups.includes(item.label)}>
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
                          ) : child.label === 'Referral Monitoring' ? (
                            <button type="button" onClick={() => { onOpenIncoming(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Doctor Assignments' ? (
                            <button type="button" onClick={() => { onOpenReferred(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.href === '#medicine-requests' ? (
                            <button type="button" onClick={() => { onOpenMedicineRequests(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.href === '#patient-distributions' ? (
                            <button type="button" onClick={() => { onOpenPatientDistributions(); closeMenu() }}><ChildIcon size={15} />{child.label}</button>
                          ) : child.href === '#medicine-inventory' ? (
                            <button type="button" onClick={() => { onOpenDistribution(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'HealthMap' ? (
                            <button type="button" onClick={() => { onOpenHealthMap(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.href === '#predictive-analytics' ? (
                            <button type="button" onClick={() => { onOpenPredictiveAnalytics(); closeMenu() }}><ChildIcon size={15} />{child.label}</button>
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
                          ) : child.label === "Who's Online?" ? (
                            <button type="button" onClick={() => { onOpenOnlineUsers(); closeMenu() }}>
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          ) : child.label === 'Personnel Activity' ? (
                            <button type="button" onClick={() => { onOpenActivity(); closeMenu() }}><ChildIcon size={15} />{child.label}</button>
                          ) : child.label === 'Manage Users' ? (
                            <button type="button" onClick={() => { onOpenManageUsers(); closeMenu() }}>
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

export default CHONavbar
