import { useId, useState } from 'react'
import MedicineCombobox from './MedicineCombobox'
import medicines from '../../../../../backend/core/medicine_catalog.json'

const categories = [...new Set(medicines.map((item) => item.category))]
const allForms = [...new Set(medicines.flatMap((item) => item.reference_presentations.map((p) => p.form)))]

export default function InventoryMedicineFields({ medicine }) {
  const id = useId()
  const existing = medicines.find((item) => item.name === medicine?.name)
  const [category, setCategory] = useState(existing?.category || medicine?.category || '')
  const [name, setName] = useState(medicine?.name || '')
  const [form, setForm] = useState(medicine?.type || '')
  const [strength, setStrength] = useState(medicine?.dosage || '')
  const entry = medicines.find((item) => item.name === name)
  const examples = entry?.reference_presentations || []
  const forms = [...new Set([...examples.map((p) => p.form), ...allForms])]
  return <>
    <label><span>Category *</span><select name="category" required value={category} onChange={(event) => {
      setCategory(event.target.value)
      if (entry?.category !== event.target.value) { setName(''); setForm(''); setStrength('') }
    }}><option value="">Select Category</option>{category && !categories.includes(category) && <option>{category}</option>}{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span>Medicine Name *</span><MedicineCombobox value={name} onChange={(value) => {
      setName(value)
      const selected = medicines.find((item) => item.name === value)
      if (selected) setCategory(selected.category)
      setForm(''); setStrength('')
    }} /><input type="hidden" name="name" value={name} /></label>
    <label><span>Type / Dosage Form *</span><select name="type" required value={form} onChange={(event) => { setForm(event.target.value); setStrength('') }}>
      <option value="">Select verified product form</option>{forms.map((item) => <option key={item}>{item}</option>)}
    </select></label>
    <label><span>Medicine Strength *</span><input name="dosage" value={strength} onChange={(event) => setStrength(event.target.value)} list={id} maxLength={50} required placeholder="Enter verified label strength" />
      <datalist id={id}>{examples.filter((p) => p.form === form && p.verified).map((p) => <option key={p.strength} value={p.strength} />)}</datalist>
      {examples.some((p) => p.form === form) && <small>Unverified reference only: {examples.filter((p) => p.form === form).map((p) => p.strength).join('; ')}. Confirm actual product label.</small>}
    </label>
    <label style={{ gridColumn: '1 / -1' }}><span><input style={{ width: 'auto', marginRight: 8 }} type="checkbox" name="formulation_verified" required /> I verified the actual dosage form and strength against the product label and an authorized reference.</span></label>
  </>
}
