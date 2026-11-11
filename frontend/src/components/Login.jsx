import { useState } from 'react'
import { Home, LogIn } from 'lucide-react'
import logo from '../assets/logo.png'
import api from '../api'
import { storeSession } from '../services/authUser'
import { getApiErrorMessage } from '../services/apiErrors'

function Login({ onBackHome, onLogin }) {
  const [credentials, setCredentials] = useState({ userId: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateCredential = (field, value) => {
    setCredentials((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const completeLogin = (data) => {
    storeSession(data)
    onLogin(data.user.role)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await api.post('auth/login/', {
        username: credentials.userId.trim().toLowerCase(),
        password: credentials.password,
      })

      completeLogin(response.data)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to sign in. Check your credentials and try again.', 'Unable to reach the sign-in service. Check that the backend is running and try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Login form">
        <img className="login-logo" src={logo} alt="MediFLOW" />
        <p className="login-intro">Enter your credentials to access your account.</p>

        <form className="login-form" onSubmit={handleSubmit}>

              <label htmlFor="user-id">User ID</label>
              <input
                id="user-id"
                type="text"
                placeholder="Enter your User ID"
                value={credentials.userId}
                onChange={(event) => updateCredential('userId', event.target.value)}
              />

              <div className="login-label-row">
                <label htmlFor="password">Password</label>
                <a href="#forgot-password">Forgot Password?</a>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Enter your Password"
                value={credentials.password}
                onChange={(event) => updateCredential('password', event.target.value)}
              />
          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={isSubmitting}>
            <LogIn size={16} />
            {isSubmitting ? 'Please Wait' : 'Sign In'}
          </button>

        </form>

        <div className="login-divider">
          <span />
          <button type="button" aria-label="Back to home" onClick={onBackHome}>
            <Home size={17} />
          </button>
          <span />
        </div>

        <div className="login-links">
          <a href="#terms">Terms of Service</a>
          <a href="#privacy">Data Privacy Policy</a>
        </div>
      </section>
    </main>
  )
}

export default Login
