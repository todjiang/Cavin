import { useEffect, useMemo, useRef, useState } from 'react'
import type { LaidOutNode } from '../data/layout'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'

const MAX_RESULTS = 8

function score(node: LaidOutNode, q: string): number {
  const title = node.title.toLowerCase()
  if (title.startsWith(q)) return 4
  if (title.includes(q)) return 3
  if (node.tags.some((t) => t.toLowerCase().includes(q))) return 2
  if (node.body.toLowerCase().includes(q)) return 1
  return 0
}

/** Case-insensitive substring highlight for the matched title. */
function Highlight({ text, q }: { text: string; q: string }) {
  const idx = text.toLowerCase().indexOf(q)
  if (idx < 0 || !q) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

/**
 * Search-to-fly: substring match over titles + tags (title starts-with >
 * title contains > tag contains, recency tiebreak). `/` or Cmd/Ctrl+K focuses,
 * ESC blurs, arrows navigate, Enter/click flies the camera to the note and
 * opens its detail panel. `?q=` URL param pre-opens with a query (previewing).
 */
export function SearchBox() {
  const select = useViewStore((s) => s.select)
  const world = useWorldStore((s) => s.world)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('q'))
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return world.nodes
      .map((n) => ({ n, s: score(n, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || b.n.createdAt - a.n.createdAt || a.n.id.localeCompare(b.n.id))
      .slice(0, MAX_RESULTS)
      .map((r) => r.n)
  }, [query, world])

  useEffect(() => {
    setActive(0)
  }, [query])

  // Global hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput = (e.target as HTMLElement)?.tagName === 'INPUT'
      if ((e.key === '/' && !inInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (node: LaidOutNode) => {
    select(node.id) // Board eases the camera to the node and DetailPanel opens
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        className="search-input"
        placeholder="search notes…  ( / )"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            inputRef.current?.blur()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => (results.length === 0 ? -1 : (a + 1) % results.length))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => (results.length === 0 ? -1 : (a - 1 + results.length) % results.length))
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active])
          }
        }}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((n, i) => {
            const parent = n.parentId ? world.nodeById.get(n.parentId) : undefined
            const kids = world.childrenByParent.get(n.id)?.length ?? 0
            return (
              <div
                key={n.id}
                className={`search-result${i === active ? ' active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => {
                  e.preventDefault()
                  go(n)
                }}
              >
                <span className="search-result-title">
                  {n.locked ? '🔒 ' : ''}
                  <Highlight text={n.title} q={query.trim().toLowerCase()} />
                </span>
                <span className="search-result-crumb" style={{ color: n.color }}>
                  {n.wingName} / {n.roomName}
                  {parent ? ` / ${parent.title}` : ''}
                  {kids > 0 ? ` · ▸${kids}` : ''}
                  {n.tags.length > 0 ? ` · ${n.tags.join(' ')}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
