import { ArrowRight } from 'lucide-react'
import heroBackground from '../assets/hero.jpg'

function Heropage({ onGetStarted }) {
  return (
    <section
      className="hero-page"
      style={{ backgroundImage: `url(${heroBackground})` }}
    >
      <div className="hero-content">
        <h1>WELCOME TO MEDIFLOW</h1>
        <p>
          It is an progressive web application for integrated referral and health management
        </p>
        <button className="hero-button" type="button" onClick={onGetStarted}>
          Get Started
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}

export default Heropage
