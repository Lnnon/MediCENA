import { Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import './CHOSettingsLayout.css'

function CHOSettings() {
  const [loginStatus, setLoginStatus] = useState('Active')

  return (
    <div className="cho-settings-styled">
      <div className="cho-page-heading">
        <div>
          <span>Settings</span>
          <h1>Account Settings</h1>
          <p>Change your password and update your active duty status.</p>
        </div>
      </div>

      <section className="cho-settings-grid">
        <article className="cho-settings-panel">
          <div className="cho-settings-heading">
            <div className="cho-settings-icon">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2>Change Password</h2>
              <p>Enables you to change your current password.</p>
            </div>
          </div>

          <form className="cho-settings-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Current Password</span>
              <input type="password" placeholder="Enter current password" />
            </label>
            <label>
              <span>New Password</span>
              <input type="password" placeholder="Enter new password" />
            </label>
            <label>
              <span>Confirm Password</span>
              <input type="password" placeholder="Confirm new password" />
            </label>
            <button type="submit">
              <Check size={15} />
              Save Password
            </button>
          </form>
        </article>

        <article className="cho-settings-panel">
          <div className="cho-settings-heading">
            <div className="cho-settings-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2>Change Active Status</h2>
              <p>Enables you to change your status from Inactive to Active or vice versa.</p>
            </div>
          </div>

          <div className="cho-status-card">
            <span>Current Status</span>
            <strong className={loginStatus === 'Active' ? 'on-duty' : 'off-duty'}>{loginStatus}</strong>
          </div>

          <div className="cho-status-toggle" aria-label="Change active status">
            <button
              className={loginStatus === 'Active' ? 'active' : ''}
              type="button"
              onClick={() => setLoginStatus('Active')}
            >
              <Check size={15} />
              Active
            </button>
            <button
              className={loginStatus === 'Inactive' ? 'active danger' : 'danger'}
              type="button"
              onClick={() => setLoginStatus('Inactive')}
            >
              Inactive
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default CHOSettings
