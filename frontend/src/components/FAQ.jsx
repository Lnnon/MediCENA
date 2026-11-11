const faqs = [
  {
    question: 'How can we request for user credentials of our Facility?',
    answer: (
      <>
        <strong>For IT/admin account:</strong> Please request for your log-in
        credentials from any of the 711 DOH CV CHD Health Line IT Tech Support
        Team via email or call.
        <br />
        <strong>For end-user accounts (i.e. Doctor, Nurse, Midwife, etc.):</strong>{' '}
        Please request for your login credentials from your IT department or
        your respective CVeHRS Point Person.
      </>
    ),
  },
  {
    question: 'Can we use the same user credentials in multiple accounts?',
    answer: 'No. Each user should use their own assigned account credentials for proper tracking and security.',
  },
  {
    question: 'How can a user reset a password?',
    answer: 'Please contact your facility administrator or IT support team to verify the account and process the password reset.',
  },
  {
    question: 'I want to update my account information. What do I do?',
    answer: 'Coordinate with your assigned administrator or point person so your profile details can be reviewed and updated.',
  },
  {
    question: "How can a user's account be deleted if he or she is no longer connected to the facility?",
    answer: 'Request account deactivation through the facility administrator to keep user access current and secure.',
  },
  {
    question: 'What is the best way for us to report issues or request user training?',
    answer: 'Send the concern to the support team with the facility name, user details, and a short description of the issue or training request.',
  },
]

function FAQ() {
  return (
    <section id="faq" className="faq-section">
      <div className="faq-inner">
        <div className="faq-heading">
          <h2>Frequently Asked Questions! Need Help?</h2>
          <span aria-hidden="true" />
          <p>We've got you covered!</p>
        </div>

        <div className="faq-list">
          {faqs.map((item, index) => (
            <details className="faq-item" key={item.question} open={index === 0}>
              <summary>
                <span className="question-icon">?</span>
                <span>{item.question}</span>
                <span className="faq-chevron" aria-hidden="true" />
              </summary>
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQ
