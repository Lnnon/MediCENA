import logo from '../assets/logo.png'

const quickLinks = ['Home', 'About', 'Services', 'Contact Us']
const footerServices = [
  'Patient Registration',
  'Health Records',
  'Referral System',
  'Analytics Dashboard',
]

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

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9h3v11H5zM6.5 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM11 9h3v1.5c.6-.9 1.6-1.7 3.1-1.7 2.3 0 3.9 1.5 3.9 4.7V20h-3v-5.9c0-1.5-.6-2.4-1.9-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9v6H11z" />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4h8c2.2 0 4 1.8 4 4v8c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4Z" />
    <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
    <path d="M16.7 7.3h.1" />
  </svg>
)

const PinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" />
    <path d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  </svg>
)

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8.2 5.4 6.5 7.1c-.6.6-.7 1.5-.3 2.3 1.5 3 3.9 5.4 6.9 6.9.8.4 1.7.3 2.3-.3l1.7-1.7-3-3-1.2 1.2c-1.5-.9-2.8-2.2-3.7-3.7l1.2-1.2-3.2-3.2Z" />
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)

function Link() {
  return (
    <footer id="links" className="footer-section">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="footer-logo" href="#home" aria-label="MediFLOW home">
              <img src={logo} alt="" />
            </a>
            <p>
              Transforming healthcare delivery in Lucena City through
              intelligent technology and data-driven insights.
            </p>
            <div className="footer-socials" aria-label="Social links">
              <a href="#facebook" aria-label="Facebook"><FacebookIcon /></a>
              <a href="#twitter" aria-label="Twitter"><TwitterIcon /></a>
              <a href="#linkedin" aria-label="LinkedIn"><LinkedInIcon /></a>
              <a href="#instagram" aria-label="Instagram"><InstagramIcon /></a>
            </div>
          </div>

          <nav className="footer-column" aria-label="Quick links">
            <h2>Quick Links</h2>
            {quickLinks.map((item) => (
              <a href={`#${item.toLowerCase().replaceAll(' ', '-')}`} key={item}>
                {item}
              </a>
            ))}
          </nav>

          <nav className="footer-column" aria-label="Services">
            <h2>Services</h2>
            {footerServices.map((item) => (
              <a href="#services" key={item}>
                {item}
              </a>
            ))}
          </nav>

          <address className="footer-contact">
            <h2>Contact Us</h2>
            <p><PinIcon /> City Health Office, Lucena City, Quezon Province</p>
            <p><PhoneIcon /> (042) 373-5301</p>
            <p><MailIcon /> info@mediflow.gov.ph</p>
          </address>
        </div>

        <div className="footer-bottom">
          <p>© 2026 MediFlow. All rights reserved. City Health Office of Lucena.</p>
          <div>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Link
