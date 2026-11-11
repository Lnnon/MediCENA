import BHCFilterToolbar from '../bhc/BHCFilterToolbar'
import { useState } from 'react'
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react'
import './NotificationsPage.css'
import NotificationSettings from './NotificationSettings'

const formatNotificationDate = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function NotificationsPage({
  role,
  notifications = [],
  onNotificationOpen = () => {},
  onMarkAllRead = () => {},
}) {
  const [search, setSearch] = useState('')
  const [readStatus, setReadStatus] = useState('')
  const visible = role === 'bhc' ? notifications.filter((item) =>
    [item.title, item.message].join(' ').toLowerCase().includes(search.trim().toLowerCase()) &&
    (!readStatus || (item.read ? 'read' : 'unread') === readStatus)) : notifications
  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <section className="notifications-page" aria-label="All notifications">
      <div className="notifications-page-heading">
        <div>
          <span>Alerts</span>
          <h1>Notifications</h1>
          <p>Monitor referrals, medicine requests, patient updates, and system alerts.</p>
        </div>
        <button type="button" onClick={onMarkAllRead} disabled={!unreadCount}>
          <CheckCheck size={17} />
          Mark all read
        </button>
      </div>

      <div className="notifications-summary">
        <div>
          <Bell size={18} />
          <strong>{unreadCount}</strong>
          <span>unread</span>
        </div>
        <div>
          <Inbox size={18} />
          <strong>{notifications.length}</strong>
          <span>latest saved</span>
        </div>
      </div>

      <NotificationSettings />

      {role === 'bhc' && <BHCFilterToolbar placeholder="Search notifications..." value={search} onSearch={setSearch} active={readStatus}>
        <label>Status<select value={readStatus} onChange={(e) => setReadStatus(e.target.value)}><option value="">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select></label>
        <button type="button" onClick={() => { setReadStatus(''); setSearch('') }}>Reset Filters</button>
      </BHCFilterToolbar>}
      <div className="notifications-list">
        {visible.length > 0 ? visible.map((notification) => (
          <button
            className={`notification-row ${notification.read ? '' : 'is-unread'}`}
            type="button"
            key={notification.id}
            onClick={() => onNotificationOpen(notification)}
          >
            <span className="notification-row-icon">
              <Bell size={16} />
            </span>
            <span className="notification-row-body">
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
              <time>{formatNotificationDate(notification.createdAt)}</time>
              <span>SMS: {(notification.smsStatus || 'not requested').replaceAll('_', ' ')}</span>
            </span>
            <ExternalLink size={16} />
          </button>
        )) : (
          <div className="notifications-empty">
            <Inbox size={22} />
            <strong>{notifications.length ? 'No matching notifications' : 'No notifications yet'}</strong>
            <span>{notifications.length ? 'Adjust your search or filters.' : 'New system activity will appear here.'}</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default NotificationsPage
