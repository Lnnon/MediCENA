import { Play } from 'lucide-react'

function Tutorial() {
  return (
    <section id="tutorial" className="tutorial-section">
      <div className="tutorial-inner">
        <div className="tutorial-copy">
          <span className="section-kicker">About</span>
          <h2>Mediflow</h2>
          <div className="tutorial-columns">
            <p>
              Mediflow expedites the application and approval process of
              insurance claims by securely and efficiently connecting insurance
              companies and medical practitioners. The service saves cost,
              eliminate cross-border duplicated claims, and provide reliable
              and relevant patient
            </p>
            <p>
              information to medical institutions and insurance companies.
              Mediflow allows patients to take full control of their own
              electronic health records, with proprietary blockchain and
              cryptographic technologies to ensure a high-level of data and
              privacy protection.
            </p>
          </div>
        </div>

        <div className="tutorial-video" aria-label="Mediflow tutorial video">
          <div className="video-frame">
            <div className="video-topbar">
              <div className="video-logo">M</div>
              <div>
                <strong>Mediflow - A progressive web application</strong>
                <span>Email</span>
              </div>
            </div>
            <div className="video-art">
              <div className="video-title">
                <strong>MEDI</strong>FLOW
              </div>
              <div className="video-flow">
                <span />
                <span />
                <span />
              </div>
              <button className="play-button" type="button" aria-label="Play tutorial">
                <Play size={34} fill="currentColor" />
              </button>
            </div>
            <div className="video-actions">
              <span>Watch on YouTube</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Tutorial
