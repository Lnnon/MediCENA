import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, Check, Edit, Loader2, Mail, Phone, ShieldCheck, UserRound, X } from 'lucide-react'
import mockProfile from '../../../assets/mock-profile.png'
import { getStoredUser, getUserDisplayName } from '../../../services/authUser'
import { fetchCurrentStaffProfile, updateCurrentStaffProfile } from '../../../services/users'

const getProfileImageKey = (user) => `mediflow_profile_image_${user?.id || user?.username || 'current'}`
const splitFirstAndMiddle = (firstName = '') => {
  const parts = firstName.trim().split(' ').filter(Boolean)
  if (parts.length <= 1) return { firstName: firstName || '', middleName: '' }
  return { firstName: parts[0], middleName: parts.slice(1).join(' ') }
}

function ProfilePage({ roleLabel = 'MediFlow User' }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const [profile, setProfile] = useState(null)
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem(getProfileImageKey(storedUser)) || mockProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      try {
        const backendProfile = await fetchCurrentStaffProfile()
        if (isMounted) {
          setProfile(backendProfile)
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setProfile({ user: storedUser })
          setErrorMessage('Unable to load full profile from the backend. Showing saved login details.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [storedUser])

  const user = profile?.user || storedUser || {}
  const displayName = getUserDisplayName(user)
  const { firstName, middleName } = splitFirstAndMiddle(user.first_name)
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const image = String(reader.result || '')
      localStorage.setItem(getProfileImageKey(user), image)
      setProfileImage(image)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    if (!profile?.id) {
      setErrorMessage('This account has no editable staff profile yet.')
      return
    }

    try {
      setIsSaving(true)
      const updatedProfile = await updateCurrentStaffProfile(profile.id, new FormData(event.currentTarget))
      setProfile(updatedProfile)
      setIsEditing(false)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to update profile information.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Account</span>
          <h1>Profile</h1>
          <p>Manage your MediFlow account identity and profile picture.</p>
        </div>
        <div className="reports-actions">
          <button type="button" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? <X size={15} /> : <Edit size={15} />}
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="patient-alert">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <section className="profile-page">
        <article className="profile-card profile-identity-card">
          <div className="profile-photo-wrap">
            <img src={profileImage} alt="Profile" />
            <span>{initials}</span>
            <label>
              <Camera size={16} />
              <input type="file" accept="image/*" onChange={handleProfileImageChange} />
            </label>
          </div>
          <h2>{displayName}</h2>
          <p>{profile?.position || roleLabel}</p>
          <strong>{user?.role || 'user'}</strong>
        </article>

        <article className="profile-card profile-detail-card">
          <header>
            <div>
              <span>Account Details</span>
              <h2>{isEditing ? 'Edit Information' : 'User Information'}</h2>
            </div>
            {isLoading ? <Loader2 className="cho-map-spin" size={18} /> : <ShieldCheck size={18} />}
          </header>

          {isEditing ? (
            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <label>
                <span>Username</span>
                <input name="username" type="text" value={user?.username || ''} disabled />
                <small>Username cannot be edited.</small>
              </label>
              <label>
                <span>First Name</span>
                <input name="firstName" type="text" defaultValue={firstName} />
              </label>
              <label>
                <span>Middle Name</span>
                <input name="middleName" type="text" defaultValue={middleName} />
              </label>
              <label>
                <span>Last Name</span>
                <input name="lastName" type="text" defaultValue={user?.last_name || ''} />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" defaultValue={user?.email || ''} />
              </label>
              <label>
                <span>Contact Number</span>
                <input name="contactNumber" type="text" defaultValue={profile?.contact_number || ''} />
              </label>
              <label>
                <span>Position</span>
                <input name="position" type="text" defaultValue={profile?.position || ''} readOnly />
              </label>
              <label>
                <span>Specialty</span>
                <input name="specialty" type="text" defaultValue={profile?.specialty || ''} />
              </label>
              <label>
                <span>Barangay Designation</span>
                <input name="barangayDesignation" type="text" defaultValue={profile?.barangay_designation || ''} readOnly />
              </label>
              <div className="medicine-form-actions">
                <button type="button" onClick={() => setIsEditing(false)}>
                  <X size={15} />
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !profile?.id}>
                  <Check size={15} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-detail-grid">
              <div>
                <UserRound size={17} />
                <span>Username</span>
                <strong>{user?.username || 'Not set'}</strong>
              </div>
              <div>
                <Mail size={17} />
                <span>Email</span>
                <strong>{user?.email || 'Not set'}</strong>
              </div>
              <div>
                <Phone size={17} />
                <span>Contact</span>
                <strong>{profile?.contact_number || 'Not set'}</strong>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Status</span>
                <strong>{user?.is_active === false ? 'Inactive' : 'Active'}</strong>
              </div>
              <div>
                <UserRound size={17} />
                <span>Position</span>
                <strong>{profile?.position || roleLabel}</strong>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Designation</span>
                <strong>{profile?.barangay_designation || profile?.specialty || profile?.facility_detail?.name || 'Not set'}</strong>
              </div>
            </div>
          )}
        </article>
      </section>
    </>
  )
}

export default ProfilePage
