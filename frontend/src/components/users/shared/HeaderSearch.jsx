import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { loadWorkspaceRecords } from './workspaceSearch'
import './HeaderSearch.css'

export default function HeaderSearch({ role, pages, notifications = [], onNotificationOpen }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [index, setIndex] = useState(null)
  const [selected, setSelected] = useState(null)
  const dialog = useRef(null)
  const input = useRef(null)
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searching = focused && words.length > 0

  useEffect(() => {
    if (!searching) return
    let active = true
    const timer = setTimeout(() => {
      loadWorkspaceRecords(role).then((data) => { if (active) setIndex(data) })
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [searching, role])

  useEffect(() => {
    if (selected) dialog.current.showModal()
  }, [selected])

  const entries = searching ? [
    ...pages.filter((page) => typeof page.onSelect === 'function').map((page) => ({ ...page, type: 'Page', key: page.label })),
    ...notifications.map((n) => ({ key: 'notification-' + n.id, label: n.title, type: 'Notification',
      details: [['Message', n.message]], onSelect: () => onNotificationOpen(n) })),
    ...(index?.records || []),
  ] : []
  const matches = entries.filter((item) => {
    const text = [item.label, item.type, item.keywords, ...(item.details || []).flat()].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
  function open(item) {
    setFocused(false)
    setQuery('')
    if (item.onSelect) item.onSelect()
    else setSelected(item)
  }

  return <div className="workspace-header-search" onBlur={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
  }}>
    <form role="search" onSubmit={(e) => { e.preventDefault(); if (matches[0]) open(matches[0]) }}>
      <Search size={16} aria-hidden="true" />
      <input ref={input} type="search" aria-label={'Search ' + role + ' workspace'} placeholder="Search workspace…"
        value={query} onFocus={() => setFocused(true)} onChange={(e) => { setQuery(e.target.value); setFocused(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') setFocused(false) }} />
    </form>
    {searching && <div className="workspace-header-results">
      {matches.map((item) => <button key={item.key} type="button" onClick={() => open(item)}>
        <small>{item.type}</small>{item.label}
      </button>)}
      {!index && <p role="status">Searching records…</p>}
      {index?.partial && <p role="status">Some records could not be loaded.</p>}
      {index && !matches.length && <p>No matches for this search.</p>}
    </div>}
    {selected && <dialog ref={dialog} className="workspace-search-detail" aria-label={selected.type + ' details'}
      onClose={() => { setSelected(null); input.current?.focus() }}>
      <small>{selected.type}</small><h2>{selected.label}</h2>
      <dl>{selected.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <button type="button" onClick={() => dialog.current.close()}>Close</button>
    </dialog>}
  </div>
}
