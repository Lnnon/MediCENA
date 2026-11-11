import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import logo from '../assets/logo.png'

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8.2 5.4 6.5 7.1c-.6.6-.7 1.5-.3 2.3 1.5 3 3.9 5.4 6.9 6.9.8.4 1.7.3 2.3-.3l1.7-1.7-3-3-1.2 1.2c-1.5-.9-2.8-2.2-3.7-3.7l1.2-1.2-3.2-3.2Z" />
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 8h2V5h-2.4C10.8 5 9 6.7 9 9.4V11H7v3h2v6h3.3v-6H15l.5-3h-3.2V9.7c0-1 .4-1.7 1.7-1.7Z" />
  </svg>
)

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 7.2c-.6.3-1.2.5-1.9.6.7-.4 1.1-1 1.4-1.8-.7.4-1.4.7-2.2.8A3.3 3.3 0 0 0 11.6 9c0 .3 0 .5.1.8A9.4 9.4 0 0 1 5 6.4a3.3 3.3 0 0 0 1 4.4c-.5 0-1-.2-1.5-.4 0 1.6 1.1 2.9 2.7 3.2-.5.1-1 .1-1.5.1.4 1.4 1.7 2.4 3.2 2.4A6.7 6.7 0 0 1 4 17.5a9.4 9.4 0 0 0 5.1 1.5c6.1 0 9.5-5.1 9.5-9.5v-.4c.6-.5 1.1-1 1.5-1.7Z" />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4h8c2.2 0 4 1.8 4 4v8c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4Z" />
    <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
    <path d="M16.7 7.3h.1" />
  </svg>
)

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9h3v11H5zM6.5 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM11 9h3v1.5c.6-.9 1.6-1.7 3.1-1.7 2.3 0 3.9 1.5 3.9 4.7V20h-3v-5.9c0-1.5-.6-2.4-1.9-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9v6H11z" />
  </svg>
)

const navItems = [
  'Home',
  'Tutorial',
  'Services',
  'FAQ',
  'Testimonials',
  'Feedback',
  'Links',
]

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <>
      <header className="site-header">
        <div className="topbar">
          <div className="topbar-inner">
            <div className="contact-list" aria-label="Contact information">
              <a href="mailto:mediflow.dll@gmail.com">
                <MailIcon />
                mediflow.dll@gmail.com
              </a>
              <a href="tel:+0324116900">
                <PhoneIcon />
                (032)411-6900
              </a>
            </div>

            <div className="social-list" aria-label="Social links">
              <a href="#facebook" aria-label="Facebook">
                <FacebookIcon />
              </a>
              <a href="#twitter" aria-label="Twitter">
                <TwitterIcon />
              </a>
              <a href="#instagram" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="#linkedin" aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>
          </div>
        </div>
      </header>

      <nav className="navbar" aria-label="Primary navigation">
        <div className="navbar-inner">
          <a className="brand" href="#home" aria-label="MediFLOW home">
            <img src={logo} alt="" />
          </a>

          <button
            className="landing-menu-button"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="landing-navigation"
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

          <ul className={`nav-menu ${isMenuOpen ? 'is-open' : ''}`} id="landing-navigation">
            <li className="mobile-sidebar-header">
              <span>Menu</span>
              <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
                <X size={18} />
              </button>
            </li>
            {navItems.map((item) => (
              <li key={item}>
                <a
                  className={item === 'Home' ? 'active' : ''}
                  href={`#${item.toLowerCase().replaceAll(' ', '-')}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  )
}

export default Navbar
