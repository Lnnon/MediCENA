import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const testimonials = [
  {
    name: 'Gov. Celestino Gallares Memorial Hospital',
    label: 'Level 3',
    badge: 'GCG',
    quote:
      'The Mediflow system had definitely leveled-up the patient transfer are being facilitated from one medical unit to another here in Bohol. For those patients transfer who have utilized this system, it has resulted in better coordination between healthcare workers and in better patient outcomes.',
  },
  {
    name: 'City Health Office',
    label: 'RHU',
    badge: 'TCH',
    quote:
      'What is good about the system in that it is great way to reduce the waiting time of the patient at the emergency unit and we will know who is the referring unit or who accepted the patient with their contact numbers and communicate with them for lacking information or updates.',
  },
  {
    name: 'Bohol Provincial Health Office',
    label: 'PHO',
    badge: 'BPH',
    quote:
      'The system supports faster coordination between facilities and helps staff monitor referral status more clearly. It gives healthcare workers a better way to follow up patient movement and medicine requests.',
  },
]

function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0)

  const visibleTestimonials = [
    testimonials[activeIndex],
    testimonials[(activeIndex + 1) % testimonials.length],
  ]

  const showPrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? testimonials.length - 1 : current - 1,
    )
  }

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % testimonials.length)
  }

  return (
    <section id="testimonials" className="testimonials-section">
      <div className="testimonials-inner">
        <div className="testimonials-carousel">
          <button
            className="testimonial-arrow testimonial-arrow-left"
            type="button"
            aria-label="Previous testimonials"
            onClick={showPrevious}
          >
            <ChevronLeft size={22} />
          </button>

          <div className="testimonials-grid">
            {visibleTestimonials.map((item) => (
              <article className="testimonial-card" key={item.name}>
                <div className="testimonial-badge">
                  <span>{item.badge}</span>
                </div>
                <div className="testimonial-content">
                  <h2>{item.name}</h2>
                  <span>{item.label}</span>
                  <blockquote>{item.quote}</blockquote>
                </div>
              </article>
            ))}
          </div>

          <button
            className="testimonial-arrow testimonial-arrow-right"
            type="button"
            aria-label="Next testimonials"
            onClick={showNext}
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="testimonial-dots" aria-label="Testimonials carousel position">
          {testimonials.map((item, index) => (
            <button
              className={index === activeIndex ? 'active' : ''}
              type="button"
              key={item.name}
              aria-label={`Show testimonial slide ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
