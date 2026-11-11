import api, { getShared } from '../api'

const getFullName = (user) => {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  return name || user?.username || 'Unnamed user'
}

const formatLastLogin = (lastLogin) => {
  if (!lastLogin) return 'Not logged in'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(lastLogin))
}

export const mapStaffProfile = (profile) => ({
  id: profile.id,
  userId: profile.user?.id || null,
  role: profile.user?.role || '',
  name: getFullName(profile.user),
  department: profile.position || (profile.user?.role === 'doctor' ? 'Doctor' : 'Barangay Health Worker'),
  contact: profile.contact_number || 'No contact number',
  username: profile.user?.username || '',
  email: profile.user?.email || '',
  specialty: profile.specialty || '',
  barangayDesignation: profile.barangay_designation || '',
  status: profile.user?.is_active ? 'Active' : 'Inactive',
  statusClass: profile.user?.is_active ? 'active' : 'inactive',
  lastLogin: formatLastLogin(profile.user?.last_login),
})

export const setStaffActive = async (profileId, isActive) => {
  const response = await api.patch(`staff-profiles/${profileId}/`, { is_active: isActive })
  return mapStaffProfile(response.data)
}

export const fetchStaffActivities = async () => {
  const response = await api.get('staff-activities/')
  return response.data
}

export const fetchDoctorStatistics = async (params = {}) => (await api.get('users/doctor-statistics/', { params })).data

export const fetchStaffUsers = async () => {
  const response = await api.get('staff-profiles/')
  return response.data.map(mapStaffProfile)
}

export const createStaffUser = async (formData, userType) => {
  const payload = {
    first_name: formData.get('firstName')?.trim(),
    middle_name: formData.get('middleName')?.trim(),
    last_name: formData.get('lastName')?.trim(),
    contact_number: formData.get('contactNumber') || '',
    email: formData.get('email') || '',
    username: formData.get('username') || '',
    password: formData.get('password') || '',
    position: userType,
    specialty: userType === 'Doctor' ? formData.get('specialty') || '' : '',
    barangay_designation:
      userType === 'Barangay Health Worker' ? formData.get('barangayDesignation') || '' : '',
  }

  const response = await api.post('staff-profiles/', payload)
  return mapStaffProfile(response.data)
}

export const fetchLucenaBarangays = async () => {
  const response = await getShared('address/lucena-city/')
  return response.data.barangays
}

export const fetchLucenaAddress = async () => {
  const response = await getShared('address/lucena-city/')
  return response.data
}

export const fetchOnlineUsers = async () => {
  const response = await api.get('users/online/')
  return response.data
}

export const fetchDoctors = async () => {
  const response = await api.get('doctors/')
  return response.data.map((doctor) => ({
    id: doctor.id,
    userId: doctor.user_id,
    name: doctor.display_name || doctor.name,
    username: doctor.username,
    specialty: doctor.specialty,
    facility: doctor.facility,
    status: doctor.status,
  }))
}

export const sendHeartbeat = async () => {
  const response = await api.post('auth/heartbeat/')
  return response.data
}

export const fetchCurrentUser = async () => {
  const response = await api.get('auth/me/')
  localStorage.setItem('user', JSON.stringify(response.data))
  return response.data
}

export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.post('auth/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return response.data
}

export const updateAccountStatus = async (isActive) => {
  const response = await api.patch('auth/account-status/', { is_active: isActive })
  localStorage.setItem('user', JSON.stringify(response.data))
  return response.data
}

export const fetchCurrentStaffProfile = async () => {
  const currentUser = await fetchCurrentUser()
  const response = await api.get('staff-profiles/')
  const profile = response.data.find((item) => item.user?.id === currentUser.id)
  return profile || { user: currentUser }
}

export const updateCurrentStaffProfile = async (profileId, formData) => {
  const payload = {
    first_name: formData.get('firstName')?.trim() || '',
    middle_name: formData.get('middleName')?.trim() || '',
    last_name: formData.get('lastName')?.trim() || '',
    email: formData.get('email')?.trim() || '',
    contact_number: formData.get('contactNumber') || '',
    position: formData.get('position') || '',
    specialty: formData.get('specialty') || '',
    barangay_designation: formData.get('barangayDesignation') || '',
  }

  const response = await api.patch(`staff-profiles/${profileId}/`, payload)
  localStorage.setItem('user', JSON.stringify(response.data.user))
  return response.data
}
