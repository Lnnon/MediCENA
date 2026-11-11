import { useEffect, useRef, useState } from 'react'
import { Send, Trash2, X } from 'lucide-react'
import { createMedicineRequestBatch } from '../../../services/medicines'

export default function MedicineRequestCart({ items, onChange, onClose, onSubmitted }) {
  const dialogRef = useRef(null)
  const submitting = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previousFocus?.focus() }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (submitting.current || !items.length) return
    if (items.length > 100 || items.some(({ quantity }) => !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000)) {
      setError('Select up to 100 medicines, with a whole-number quantity from 1 to 1000 each.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    setError('')
    let requests
    try {
      requests = await createMedicineRequestBatch(items)
    } catch (failure) {
      const data = failure.response?.data
      const messages = (value) => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(messages) : []
      setError(messages(data).join(' ') || 'Unable to confirm submission. Your selections are kept. Check Medicine Requests before retrying if the connection was interrupted.')
      submitting.current = false
      setIsSubmitting(false)
      return
    }
    onSubmitted(requests)
  }

  return <dialog ref={dialogRef} className="medicine-cart-dialog" aria-labelledby="medicine-cart-title" onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose() }}>
    <header><div><h2 id="medicine-cart-title">Medicine Request Cart</h2><p>Review quantities before requesting supplies from the City Health Office.</p></div><button type="button" aria-label="Close request cart" disabled={isSubmitting} onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={submit}>
      {error && <p className="patient-alert" role="alert">{error}</p>}
      <p className="medicine-cart-summary">{items.length} medicine{items.length === 1 ? '' : 's'} selected · Each medicine will be sent for approval.</p>
      <div className="medicine-cart-items">
        {items.map((item) => <div className="medicine-cart-item" key={item.medicineId}>
          <div><strong>{item.name}</strong><span>{item.type} · {item.dosage}</span><small>Current stock: {item.stocks}</small></div>
          <label><span>Quantity requested</span><input type="number" min="1" max="1000" step="1" required disabled={isSubmitting} value={item.quantity} aria-label={`Quantity for ${item.name} ${item.dosage}`} onChange={(event) => onChange(items.map((entry) => entry.medicineId === item.medicineId ? { ...entry, quantity: event.target.value } : entry))} /></label>
          <button type="button" className="medicine-cart-remove" disabled={isSubmitting} aria-label={`Remove ${item.name} ${item.dosage}`} onClick={() => onChange(items.filter((entry) => entry.medicineId !== item.medicineId))}><Trash2 size={17} /></button>
        </div>)}
        {!items.length && <p>No medicines selected. Close this window to select medicines from the inventory.</p>}
      </div>
      <footer><button type="button" disabled={isSubmitting} onClick={onClose}>Continue selecting</button><button type="submit" disabled={isSubmitting || !items.length}><Send size={15} />{isSubmitting ? 'Submitting…' : `Submit ${items.length} Request${items.length === 1 ? '' : 's'}`}</button></footer>
    </form>
  </dialog>
}
