import { useId, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import './BHCFilterToolbar.css'

export default function BHCFilterToolbar({ placeholder, value, onSearch, active, actions, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <section className="bhc-filter-toolbar" aria-label="Search and filters">
    <div className="bhc-toolbar-row">
      {onSearch && <label className="bhc-toolbar-search"><Search size={16} aria-hidden="true" />
        <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onSearch(event.target.value)} />
      </label>}
      <button className="bhc-toolbar-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Filter size={15} />Filters{active ? ' (active)' : ''}
      </button>
      {actions}
    </div>
    <div id={id} className="bhc-toolbar-options" hidden={!open}>{children}</div>
  </section>
}
