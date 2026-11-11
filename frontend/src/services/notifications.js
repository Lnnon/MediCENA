import api, { getShared } from '../api'

export const mapNotification = (notification) => ({
  id: notification.id,
  type: notification.notification_type,
  title: notification.title,
  message: notification.message,
  targetPage: notification.target_page || 'dashboard',
  objectType: notification.object_type || '',
  objectId: notification.object_id || null,
  read: Boolean(notification.is_read),
  createdAt: notification.created_at,
  actor: notification.actor_detail || null,
  smsStatus: notification.sms_status || 'not_requested',
})

export const fetchNotifications = async () => {
  const response = await getShared('notifications/')
  return response.data.map(mapNotification)
}

export const markNotificationRead = async (notificationId) => {
  if (!Number.isInteger(Number(notificationId))) return null
  const response = await api.patch(`notifications/${notificationId}/`, { is_read: true })
  return mapNotification(response.data)
}

export const markNotificationsRead = async (notifications) => {
  await Promise.all(
    notifications
      .filter((notification) => !notification.read && Number.isInteger(Number(notification.id)))
      .map((notification) => markNotificationRead(notification.id)),
  )
}

export const fetchNotificationPreferences = async () => (await api.get('notifications/preferences/')).data
export const saveNotificationPreferences = async (data) => (await api.patch('notifications/preferences/', data)).data
export const fetchDeliveryLogs = async () => (await api.get('notifications/delivery-logs/')).data
export const sendAnnouncement = async (data) => (await api.post('notifications/announcements/', data)).data
