import { AlertTriangle, Check, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { changePassword, fetchCurrentUser, updateAccountStatus } from '../../../services/users'

function PatientSettings() {
  const [loginStatus, setLoginStatus] = useState('Active')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      setIsLoading(true)
      try {
        const user = await fetchCurrentUser()
        if (!isMounted) return
        setLoginStatus(user.is_active ? 'Active' : 'Inactive')
        setErrorMessage('')
      } catch {
        if (isMounted) setErrorMessage('Unable to load your account settings from the backend.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  const updatePasswordField = (field, value) => {
    setPasswordForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New password and confirm password do not match.')
      return
    }

    setIsSavingPassword(true)
    try {
      const response = await changePassword(passwordForm)
      setMessage(response.detail || 'Password updated successfully.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Unable to update password.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleStatusChange = async (nextStatus) => {
    setMessage('')
    setErrorMessage('')
    setIsSavingStatus(true)

    try {
      const user = await updateAccountStatus(nextStatus === 'Active')
      setLoginStatus(user.is_active ? 'Active' : 'Inactive')
      setMessage(`Account status changed to ${user.is_active ? 'Active' : 'Inactive'}.`)
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Unable to update account status.')
    } finally {
      setIsSavingStatus(false)
    }
  }

  return (
    <>
      <div className="patient-page-heading">
        <div>
          <span>Settings</span>
          <h1>Account Settings</h1>
          <p>Change your password and update your account active status.</p>
        </div>
      </div>

      {message && (
        <div className="patient-settings-message">
          <Check size={16} />
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="patient-settings-message patient-settings-error">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <section className="patient-settings-grid">
        <article className="patient-settings-panel">
          <div className="patient-settings-heading">
            <div className="patient-settings-icon">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2>Change Password</h2>
              <p>Enables you to change your current password.</p>
            </div>
          </div>

          <form className="patient-settings-form" onSubmit={handlePasswordSubmit}>
            <label>
              <span>Current Password</span>
              <input
                type="password"
                placeholder="Enter current password"
                value={passwordForm.currentPassword}
                onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
                required
              />
            </label>
            <label>
              <span>New Password</span>
              <input
                type="password"
                placeholder="Enter new password"
                value={passwordForm.newPassword}
                onChange={(event) => updatePasswordField('newPassword', event.target.value)}
                required
                minLength={8}
              />
            </label>
            <label>
              <span>Confirm Password</span>
              <input
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) => updatePasswordField('confirmPassword', event.target.value)}
                required
                minLength={8}
              />
            </label>
            <button type="submit" disabled={isSavingPassword || isLoading}>
              {isSavingPassword ? <Loader2 className="cho-map-spin" size={15} /> : <Check size={15} />}
              {isSavingPassword ? 'Saving...' : 'Save Password'}
            </button>
          </form>
        </article>

        <article className="patient-settings-panel">
          <div className="patient-settings-heading">
            <div className="patient-settings-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2>Change Active Status</h2>
              <p>Enables you to change your status from Inactive to Active or vice versa.</p>
            </div>
          </div>

          <div className="patient-status-card">
            <span>Current Status</span>
            <strong className={loginStatus === 'Active' ? 'on-duty' : 'off-duty'}>
              {isLoading ? 'Loading...' : loginStatus}
            </strong>
          </div>

          <div className="patient-status-toggle" aria-label="Change active status">
            <button
              className={loginStatus === 'Active' ? 'active' : ''}
              type="button"
              disabled={isLoading || isSavingStatus || loginStatus === 'Active'}
              onClick={() => handleStatusChange('Active')}
            >
              {isSavingStatus && loginStatus !== 'Active' ? <Loader2 className="cho-map-spin" size={15} /> : <Check size={15} />}
              {isSavingStatus && loginStatus !== 'Active' ? 'Saving...' : 'Active'}
            </button>
            <button
              className={loginStatus === 'Inactive' ? 'active danger' : 'danger'}
              type="button"
              disabled={isLoading || isSavingStatus || loginStatus === 'Inactive'}
              onClick={() => handleStatusChange('Inactive')}
            >
              {isSavingStatus && loginStatus !== 'Inactive' ? 'Saving...' : 'Inactive'}
            </button>
          </div>
        </article>
      </section>
    </>
  )
}

export default PatientSettings
