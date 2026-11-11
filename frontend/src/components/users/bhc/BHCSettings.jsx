import { Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

function BHCSettings() {
  const [loginStatus, setLoginStatus] = useState('On-Duty')

  return (
    <>
      <div className="bhc-page-heading">
        <div>
          <span>Settings</span>
          <h1>Account Settings</h1>
          <p>Change your password and update your login duty status.</p>
        </div>
      </div>

      <section className="bhc-settings-grid">
        <article className="bhc-settings-panel">
          <div className="bhc-settings-heading">
            <div className="bhc-settings-icon">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2>Change Password</h2>
              <p>Enables you to change your current password.</p>
            </div>
          </div>

          <form className="bhc-settings-form" onSubmit={(event) => event.preventDefault()}>
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

        <article className="bhc-settings-panel">
          <div className="bhc-settings-heading">
            <div className="bhc-settings-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2>Change Login Status</h2>
              <p>Enables you to change your status from Off-Duty to On-Duty or vice versa.</p>
            </div>
          </div>

          <div className="bhc-status-card">
            <span>Current Status</span>
            <strong className={loginStatus === 'On-Duty' ? 'on-duty' : 'off-duty'}>{loginStatus}</strong>
          </div>

          <div className="bhc-status-toggle" aria-label="Change login status">
            <button
              className={loginStatus === 'On-Duty' ? 'active' : ''}
              type="button"
              onClick={() => setLoginStatus('On-Duty')}
            >
              <Check size={15} />
              On-Duty
            </button>
            <button
              className={loginStatus === 'Off-Duty' ? 'active danger' : 'danger'}
              type="button"
              onClick={() => setLoginStatus('Off-Duty')}
            >
              Off-Duty
            </button>
          </div>
        </article>
      </section>
    </>
  )
}

export default BHCSettings
