const services = [
  {
    title: 'Refer Patient',
    description: 'Allows to refer a patient from health center to health office.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h9v6H4z" />
        <path d="M11 8h6" />
        <path d="m15 6 3 2-3 2" />
        <path d="M7 15a3 3 0 0 1 6 0v1H7z" />
        <path d="M10 11.5a1.5 1.5 0 1 0 0-3" />
      </svg>
    ),
  },
  {
    title: 'Accept Patient',
    description: 'Allows to accept patient referrals from the referring facility.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 11.5 9.5 16 19 6" />
        <path d="M5 19h14" />
        <path d="M5 5h9" />
      </svg>
    ),
  },
  {
    title: 'Arrive Patient',
    description: 'Indication that the patient has arrived in the accepting facility.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M8 20v-6h8v6" />
        <path d="M10 11h4" />
        <path d="M12 9v4" />
        <path d="M6 20h16" />
      </svg>
    ),
  },
  {
    title: 'Request Medicine',
    description: 'Allows bhc to request medicine in the health office.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5h8v3H8z" />
        <path d="M6 8h12v13H6z" />
        <path d="M12 12v5" />
        <path d="M9.5 14.5h5" />
        <path d="M16 4v1" />
      </svg>
    ),
  },
  {
    title: 'Accept Request',
    description: 'Allows health office to accept medicine requests from bhc.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h9l3 3v11H7z" />
        <path d="M16 5v4h4" />
        <path d="m9.5 14 2 2 4.5-5" />
      </svg>
    ),
  },
  {
    title: 'Receive Medicine',
    description: 'Indication that the requested medicine has been received by the bhc.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14v11H5z" />
        <path d="M8 8V5h8v3" />
        <path d="M12 11v5" />
        <path d="M9.5 13.5h5" />
        <path d="m16.5 15 2 2 3-4" />
      </svg>
    ),
  },
]

function Services() {
  return (
    <section id="services" className="services-section">
      <div className="services-inner">
        <div className="section-heading">
          <h2>Services</h2>
          <span aria-hidden="true" />
          <p>Referral system & Medicine Coordination</p>
        </div>

        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <div className="service-icon">{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Services
