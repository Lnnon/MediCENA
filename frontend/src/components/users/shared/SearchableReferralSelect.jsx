import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './MedicineCombobox.css'

export default function SearchableReferralSelect({ name, items, label, placeholder = 'Search...', required = false, disabled = false, defaultValue = '', onValueChange, menuClassName = '' }) {
  const [value, setValue] = useState(defaultValue)
  const onChange = (next) => { setValue(next); onValueChange?.(next) }
  const id = useId()
  const input = useRef(null)
  const menu = useRef(null)
  const [open, setOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState(null)
  const [query, setQuery] = useState(value || '')
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({})
  const options = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = items.find((item) => String(item.value) === String(value))
  useEffect(() => {
    input.current?.setCustomValidity(!selected && (required || query.trim()) ? 'Select an option from the list.' : '')
  }, [selected, required, query])
  const choose = (item) => { onChange(item?.value || ''); setQuery(item?.label || ''); setOpen(false) }
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
    <input type="hidden" name={name} value={selected?.value || ''} disabled={disabled} />
    <input ref={input} id={id} aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined} value={open ? query : selected?.label || ''} disabled={disabled} required={required} placeholder={placeholder} autoComplete="off"
      onFocus={(event) => { setPortalTarget(event.currentTarget.closest('dialog') || document.body); setQuery(''); setActive(0); setOpen(true) }}
      onChange={(event) => { setQuery(event.target.value); onChange(''); setActive(0); setOpen(true) }}
      onKeyDown={(event) => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); setActive((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))) }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (options[active]) choose(options[active]) }
        if (event.key === 'Escape' || event.key === 'Tab') setOpen(false)
      }} />
    {value && <button className="medicine-combobox-clear" type="button" disabled={disabled} aria-label={`Clear ${label}`} onClick={() => { choose(null); input.current.focus() }}>×</button>}
    {open && portalTarget && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-label={`${label} options`} className={`medicine-combobox-options ${menuClassName}`} style={position}>{options.length ? options.map((item, index) => <div key={item.value} id={`${id}-${index}`} role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}><span>{item.label}</span>{item.description && <small>{item.description}</small>}</div>) : <p>No options found</p>}</div>, portalTarget)}
  </div>
}
