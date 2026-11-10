import { useEffect, useState } from 'react'
import type { CavinNode } from '@cavin/core'
import { labelOf, tagsOf } from '@cavin/core'
import { useCavin } from '../context'

/** Minimal typed-relation editor. The command layer remains the only place
    that decides whether a subject/predicate/object triple is legal. */
export function RelationEditor({ node }: { node: CavinNode }) {
  const { adapter, world: useWorld } = useCavin()
  const world = useWorld((state) => state.world)
  const connectNodes = useWorld((state) => state.connectNodes)
  const ontology = adapter.ontology
  const relations = ontology?.relations ?? []

  const [open, setOpen] = useState(false)
  const [predicate, setPredicate] = useState(relations[0]?.id ?? '')
  const [targetId, setTargetId] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setOpen(false)
    setPredicate(relations[0]?.id ?? '')
    setTargetId('')
    setQuery('')
  }, [node.id])

  if (!ontology || node.state.locked) return null

  const relation = relations.find((item) => item.id === predicate)
  const target = world.nodeById.get(targetId)
  const normalizedQuery = query.trim().toLowerCase()
  const candidates = world.nodes.filter(
    (candidate) =>
      candidate.id !== node.id &&
      (!normalizedQuery ||
        labelOf(adapter, candidate).toLowerCase().includes(normalizedQuery) ||
        candidate.groupPath.some((group) => group.toLowerCase().includes(normalizedQuery)) ||
        tagsOf(adapter, candidate).some((tag) => tag.toLowerCase().includes(normalizedQuery))),
  )

  const connect = () => {
    if (!target || !relation) return
    const result = connectNodes(node.id, target.id, relation.id)
    if (result.ok) {
      setOpen(false)
      setTargetId('')
      setQuery('')
    }
  }

  return (
    <div className="detail-children">
      <div className="detail-children-title">semantic relations</div>
      {!open ? (
        <div className="detail-actions">
          <button className="detail-btn" onClick={() => setOpen(true)}>
            ＋ Relation
          </button>
        </div>
      ) : (
        <div className="parent-picker">
          <select
            className="detail-input"
            aria-label="Relation type"
            value={predicate}
            onChange={(event) => setPredicate(event.target.value)}
          >
            {relations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.domain} → {item.range}
              </option>
            ))}
          </select>
          <input
            className="detail-input"
            aria-label="Relation target"
            placeholder={`Search target ${adapter.noun}…`}
            value={query}
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value)
              setTargetId('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
            }}
          />
          <div className="parent-picker-list">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                className="parent-option"
                onClick={() => {
                  setTargetId(candidate.id)
                  setQuery(labelOf(adapter, candidate))
                }}
              >
                <span className="parent-option-title">{labelOf(adapter, candidate)}</span>
                <span className="parent-option-crumb">{candidate.groupPath.join(' / ')}</span>
              </button>
            ))}
            {candidates.length === 0 && (
              <div className="detail-empty">no matching {adapter.noun}s</div>
            )}
          </div>
          {relation && target && (
            <div className="confirm-row">
              {labelOf(adapter, node)} —{relation.label}→ {labelOf(adapter, target)}
            </div>
          )}
          <div className="detail-actions">
            <button className="detail-btn primary" disabled={!relation || !target} onClick={connect}>
              Connect
            </button>
            <button className="detail-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
