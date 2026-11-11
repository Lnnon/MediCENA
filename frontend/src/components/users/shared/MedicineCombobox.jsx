import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import medicines from '../../../../../backend/core/medicine_catalog.json'
import './MedicineCombobox.css'

export default function MedicineCombobox({ value, onChange, disabled = false, category = '' }) {
  const id = useId()
  const input = useRef(null)
  const menu = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({})
  const options = medicines.filter((item) => (!category || item.category === category) && item.name.toLowerCase().includes(query.trim().toLowerCase()))
  const choose = (name) => { onChange(name); setQuery(name); setOpen(false) }
  useEffect(() => {
    if (!open) return undefined
    const place = () => {
      const rect = input.current.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom
      setPosition({ position: 'fixed', left: rect.left, width: rect.width, ...(below < 200 && rect.top > 200 ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) })
    }
    const outside = (event) => { if (!input.current?.parentElement.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false) }
    place()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => { menu.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])
  return <div className="medicine-combobox">
    <input ref={input} id={id} aria-label="Medicine" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined} value={open ? query : value} disabled={disabled} required placeholder="Search medicines..." autoComplete="off"
      onFocus={() => { setQuery(''); setActive(0); setOpen(true) }}
      onChange={(event) => { setQuery(event.target.value); onChange(''); setActive(0); setOpen(true) }}
      onKeyDown={(event) => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); setActive((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))) }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (options[active]) choose(options[active].name) }
        if (event.key === 'Escape' || event.key === 'Tab') setOpen(false)
      }} />
    {value && <button className="medicine-combobox-clear" type="button" disabled={disabled} aria-label="Clear medicine" onClick={() => { choose(''); input.current.focus() }}>×</button>}
    {open && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-label="Medicine options" className="medicine-combobox-options" style={position}>{options.length ? options.map((item, index) => <div key={item.name} id={`${id}-${index}`} role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item.name)}><span>{item.name}</span><small>{item.category}</small></div>) : <p>No medicine found</p>}</div>, document.body)}
  </div>
}
