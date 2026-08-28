import { useEffect, useMemo, useRef, useState } from 'react'
import { bodyOf, labelOf, tagsOf, timeOf } from '@cavin/core'
import type { CavinNode } from '@cavin/core'
import { useCavin } from '../context'
import { buildPalette } from '../presentation'

const MAX_RESULTS = 8

/**
 * Search-to-fly: substring match via the adapter's own scoring order
 * (label prefix > label > tags > body), recency tiebreak on the adapter's
 * time axis when present. `/` or Cmd/Ctrl+K focuses, ESC blurs, arrows
 * navigate, Enter/click flies the camera to the node and opens its detail
 * panel. `?q=` URL param pre-opens with a query (previewing).
 */
export function SearchBox() {
  const { adapter, view: useView, world: useWorld } = useCavin()
  const select = useView((s) => s.select)
  const world = useWorld((s) => s.world)
  const palette = useMemo(() => buildPalette(adapter, world), [adapter, world])
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('q'))
  const [active, setActive] = useState(0)

  /** Ranking mirrors the field descriptors: label prefix > label > tags > body. */
  const score = (node: CavinNode, q: string): number => {
    const label = labelOf(adapter, node).toLowerCase()
    if (label.startsWith(q)) return 4
    if (label.includes(q)) return 3
    if (tagsOf(adapter, node).some((t) => t.toLowerCase().includes(q))) return 2
    if (bodyOf(adapter, node).toLowerCase().includes(q)) return 1
    return 0
  }

  /** Case-insensitive substring highlight for the matched title. */
  const Highlight = ({ text, q }: { text: string; q: string }) => {
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const timeKey = (n: CavinNode) => timeOf(adapter, n) ?? -Infinity
    return world.nodes
      .map((n) => ({ n, s: score(n, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || timeKey(b.n) - timeKey(a.n) || a.n.id.localeCompare(b.n.id))
      .slice(0, MAX_RESULTS)
      .map((r) => r.n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, world, adapter])

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

  const go = (node: CavinNode) => {
    select(node.id) // Board eases the camera to the node and DetailPanel opens
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        className="search-input"
        placeholder={`search ${adapter.noun}s…  ( / )`}
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
            const tags = tagsOf(adapter, n)
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
                  {n.state.locked ? '🔒 ' : ''}
                  <Highlight text={labelOf(adapter, n)} q={query.trim().toLowerCase()} />
                </span>
                <span className="search-result-crumb" style={{ color: palette.nodeColor(n) }}>
                  {n.groupPath.join(' / ')}
                  {parent ? ` / ${labelOf(adapter, parent)}` : ''}
                  {kids > 0 ? ` · ▸${kids}` : ''}
                  {tags.length > 0 ? ` · ${tags.join(' ')}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
