import { Send } from 'lucide-react'

const contactItems = [
  {
    title: 'Location:',
    detail: 'City Government Complex, Diversion Road Kanlurang, Lucena City, Quezon',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" />
        <path d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    ),
  },
  {
    title: 'Email:',
    detail: 'mediflow.dll@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    ),
  },
  {
    title: 'Call:',
    detail: '(032)411-6900',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.2 5.4 6.5 7.1c-.6.6-.7 1.5-.3 2.3 1.5 3 3.9 5.4 6.9 6.9.8.4 1.7.3 2.3-.3l1.7-1.7-3-3-1.2 1.2c-1.5-.9-2.8-2.2-3.7-3.7l1.2-1.2-3.2-3.2Z" />
      </svg>
    ),
  },
]

function Feedback() {
  return (
    <section id="feedback" className="feedback-section">
      <div className="feedback-heading">
        <h2>Feedback</h2>
        <span aria-hidden="true" />
        <p>We'd love your feedback!</p>
      </div>

      <div className="feedback-map">
        <iframe
          title="Lucena City Health Office map"
          src="https://www.google.com/maps?q=City%20Health%20Office%20Lucena%20City%20Government%20Complex%20Diversion%20Road%20Kanlurang%20Lucena%20City%20Quezon&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="feedback-inner">
        <div className="feedback-contact">
          {contactItems.map((item) => (
            <div className="feedback-contact-item" key={item.title}>
              <div className="feedback-icon">{item.icon}</div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <form className="feedback-form">
          <div className="form-row">
            <input type="text" placeholder="Your Name/Facility Name" aria-label="Your Name or Facility Name" />
            <input type="email" placeholder="Your Email" aria-label="Your Email" />
          </div>
          <div className="form-row">
            <input type="text" placeholder="Subject" aria-label="Subject" />
            <input type="tel" placeholder="Your Contact Number" aria-label="Your Contact Number" />
          </div>
          <textarea placeholder="Message" aria-label="Message" rows="6" />
          <button type="submit">
            <Send size={16} />
            Send Feedback
          </button>
        </form>
      </div>
    </section>
  )
}

export default Feedback
