import { useState } from 'react'
import { Bell, Boxes, ChevronDown, ClipboardList, FileText, LayoutDashboard, LockKeyhole, LogOut, Menu, PackageCheck, Send, Settings, ShieldCheck, Truck, UserCheck, X } from 'lucide-react'
import logo from '../../../assets/logo.png'
import mockProfile from '../../../assets/mock-profile.png'
import HeaderSearch from './HeaderSearch'

const groups = {
  opd: [
    { label: 'Referral', icon: Send, children: [['incoming', 'Incoming', Truck], ['referrals', 'Manage Referrals', UserCheck]] },
  ],
  pharmacist: [
    { label: 'Medicine', icon: Boxes, children: [['inventory', 'Inventory', PackageCheck], ['medicineRequests', 'List of Requests', ClipboardList]] },
  ],
}

function RoleNavbar({ role, page, onNavigate, onLogout, currentUserName, notifications, onNotificationOpen }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState('')
  const label = role === 'opd' ? 'OPD' : 'Pharmacist'
  const unread = notifications.filter((item) => !item.read).length
  const navigate = (target) => { onNavigate(target); setMenuOpen(false); setNoticesOpen(false); setExpandedGroup('') }
  const items = [...groups[role], { label: 'Reports', icon: FileText, children: [['reports', role === 'opd' ? 'Referral Reports' : 'Pharmacy Reports', FileText]] }, { label: 'Settings', icon: Settings, children: [['settings', 'Change Password', LockKeyhole], ['settings', 'Change Active Status', ShieldCheck]] }]
  return <header className="cho-header role-header">
    <div className="cho-topnav">
      <button className="cho-brand" type="button" aria-label={`${label} dashboard`} onClick={() => navigate('dashboard')}><img src={logo} alt="MediFlow" /><span className="workspace-role-label">{label}</span></button>
      <HeaderSearch role={role} notifications={notifications} onNotificationOpen={onNotificationOpen}
        pages={[
          ...['dashboard', 'profile', 'notifications', 'settings'].map((id) => ({
            label: id[0].toUpperCase() + id.slice(1), onSelect: () => navigate(id),
          })),
          ...items.flatMap((group) => group.children.map(([id, title]) => ({
            label: title, keywords: group.label, onSelect: () => navigate(id),
          }))),
        ]} />
      <div className="cho-notification-wrap">
        <button className="cho-notification" type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={noticesOpen} onClick={() => setNoticesOpen((current) => !current)}><Bell size={18} />{unread > 0 && <span aria-hidden="true" />}</button>
        {noticesOpen && <div className="cho-notification-menu role-notification-menu"><header><strong>Notifications</strong><span>{unread} new</span></header>{notifications.length ? notifications.slice(0, 8).map((item) => <button type="button" key={item.id} className={item.read ? '' : 'is-unread'} onClick={() => { onNotificationOpen(item); setNoticesOpen(false) }}><strong>{item.title}</strong><span>{item.message}</span><time>{new Date(item.createdAt).toLocaleString()}</time></button>) : <p>No notifications yet.</p>}<button className="notification-view-all" type="button" onClick={() => navigate('notifications')}>View all notifications</button></div>}
      </div>
      <button className="cho-profile" type="button" onClick={() => navigate('profile')}><div className="cho-avatar"><img src={mockProfile} alt="" /></div><div><strong>{currentUserName}</strong><span>online</span></div></button>
    </div>
    <nav className="cho-navbar" aria-label={`${label} navigation`}>
      <button className="cho-menu-button" type="button" aria-expanded={menuOpen} aria-controls={`${role}-navigation`} onClick={() => setMenuOpen((current) => !current)}><Menu size={18} />Menu</button>
      <button className={`mobile-nav-backdrop ${menuOpen ? 'is-open' : ''}`} type="button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
      <ul className={`cho-nav-list ${menuOpen ? 'is-open' : ''}`} id={`${role}-navigation`}>
        <li className="mobile-sidebar-header"><span>{label} Menu</span><button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button></li>
        <li><button className={page === 'dashboard' ? 'role-nav-active' : ''} aria-current={page === 'dashboard' ? 'page' : undefined} type="button" onClick={() => navigate('dashboard')}><LayoutDashboard size={16} /><span className="medical-nav-label">Dashboard</span></button></li>
        {items.map(({ label: groupLabel, icon: Icon, children }) => {
          const badge = groupLabel === 'Referral' ? notifications.filter((item) => !item.read && ['incoming', 'referred', 'referrals'].includes(item.targetPage)).length : groupLabel === 'Medicine' ? notifications.filter((item) => !item.read && item.targetPage === 'medicineRequests').length : 0
          return <li className={`has-dropdown ${expandedGroup === groupLabel ? 'role-group-open' : ''}`} key={groupLabel}>
            <button type="button" aria-expanded={expandedGroup === groupLabel} onClick={() => setExpandedGroup((current) => current === groupLabel ? '' : groupLabel)}><Icon size={16} aria-label={groupLabel} /><span className="medical-nav-label">{groupLabel}</span>{badge > 0 && <span className="cho-nav-badge">{badge} New</span>}<ChevronDown className="nav-chevron" size={14} /></button>
            <ul className="cho-dropdown" hidden={expandedGroup !== groupLabel}>{children.map(([id, childLabel, ChildIcon], index) => {
              const selected = page === id && children.findIndex(([target]) => target === id) === index
              return <li key={childLabel}><button type="button" aria-current={selected ? 'page' : undefined} className={selected ? 'role-nav-active' : ''} onClick={() => navigate(id)}><ChildIcon size={15} />{childLabel}</button></li>
            })}</ul>
          </li>
        })}
        <li className="medical-sidebar-logout"><button type="button" title="Logout" onClick={onLogout}><LogOut size={17} /><span className="medical-nav-label">Logout</span></button></li>
      </ul>
    </nav>
  </header>
}
export default RoleNavbar
