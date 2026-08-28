import { useEffect, useMemo, useRef, useState } from 'react'
import type { CavinNode } from '@cavin/core'
import { bodyOf, deletableSubtree, labelOf, tagsOf, timeFieldOf, timeOf } from '@cavin/core'
import { useCavin } from '../context'
import { buildPalette } from '../presentation'
import { formatTimeValue, timeDomainOf } from './time'

/**
 * Right-side panel for the selected node. View mode shows content, the
 * ancestor path for nested nodes, a parent row with a searchable re-parent
 * picker (or promote-to-root), a clickable children list, and the action
 * row (lock, edit, add-child, reset-to-grid/orbit, delete with cascade-aware
 * inline confirm); edit mode swaps in form fields generated from the
 * adapter's field descriptors. Locked nodes render read-only behind a
 * banner — the command layer guards every mutation, so nothing here can
 * bypass the lock.
 */
export function DetailPanel() {
  const { adapter, view: useView, world: useWorld } = useCavin()
  const selectedId = useView((s) => s.selectedId)
  const select = useView((s) => s.select)
  const world = useWorld((s) => s.world)
  const editingId = useWorld((s) => s.editingId)
  const setEditing = useWorld((s) => s.setEditing)
  const updateNode = useWorld((s) => s.updateNode)
  const removeNode = useWorld((s) => s.removeNode)
  const toggleLock = useWorld((s) => s.toggleLock)
  const resetToGrid = useWorld((s) => s.resetToGrid)
  const addChild = useWorld((s) => s.addChild)
  const reparentNode = useWorld((s) => s.reparentNode)
  const promoteNode = useWorld((s) => s.promoteNode)
  const confirmEdge = useWorld((s) => s.confirmEdge)
  const unlinkEdge = useWorld((s) => s.unlinkEdge)

  const palette = useMemo(() => buildPalette(adapter, world), [adapter, world])
  const timeDomain = useMemo(() => timeDomainOf(world.nodes, adapter), [adapter, world])
  const timeField = timeFieldOf(adapter)

  /** The edit form is generated from the adapter's editable field descriptors. */
  const EDITABLE = adapter.fields.filter((f) => f.kind !== 'readonly')
  /** The first text-kind field is the label field — required, autofocused. */
  const LABEL_FIELD = EDITABLE.find((f) => f.kind === 'text')

  const node = selectedId ? world.nodeById.get(selectedId) : undefined
  const editing = !!node && editingId === node.id

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [parentQuery, setParentQuery] = useState('')
  const labelRef = useRef<HTMLInputElement>(null)

  /** A field's current value as edit-draft text (tags are comma-joined). */
  const fieldDraft = (f: { key: string; kind: string }, n: CavinNode): string => {
    const v = (n.attributes as Record<string, unknown>)[f.key]
    if (f.kind === 'tags') return Array.isArray(v) ? (v as string[]).join(', ') : ''
    return typeof v === 'string' ? v : ''
  }

  // Seed the draft fields when entering edit mode; reset confirm on selection change.
  useEffect(() => {
    setConfirming(false)
    setDiscarding(false)
    setPicking(false)
    setParentQuery('')
    if (editing && node) {
      const next: Record<string, string> = {}
      for (const f of EDITABLE) next[f.key] = fieldDraft(f, node)
      setDrafts(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, selectedId])

  if (!node) return null

  // Ancestor path, immediate parent first → render root-first.
  const ancestors: { id: string; label: string }[] = []
  {
    let cur = node
    let guard = 0
    while (cur.parentId && guard++ < 32) {
      const parent = world.nodeById.get(cur.parentId)
      if (!parent) break
      ancestors.unshift({ id: parent.id, label: labelOf(adapter, parent) })
      cur = parent
    }
  }

  const children = world.childrenByParent.get(node.id) ?? []
  const doomedCount = confirming ? deletableSubtree(world, node.id).size : 0
  const parentNode = node.parentId ? world.nodeById.get(node.parentId) : undefined

  // Cross-domain connections touching this node: confirmed first, then the
  // machine suggestions the curator can confirm (or ignore).
  const connections = (world.edgesByNode.get(node.id) ?? []).map((e) => ({
    edge: e,
    other: world.nodeById.get(e.from === node.id ? e.to : e.from)!,
  }))
  const confirmedConnections = connections.filter((c) => c.edge.kind === 'confirmed')
  const suggestedConnections = connections.filter((c) => c.edge.kind === 'suggested')

  // Re-parent picker candidates: anything except the node itself, its
  // descendants (cycle), locked targets, and the current parent.
  const excluded = new Set<string>([node.id])
  if (picking) {
    const stack = [node.id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const c of world.childrenByParent.get(cur) ?? []) {
        if (!excluded.has(c.id)) {
          excluded.add(c.id)
          stack.push(c.id)
        }
      }
    }
  }
  const pq = parentQuery.trim().toLowerCase()
  const parentCandidates = picking
    ? world.nodes
        .filter(
          (n) =>
            !excluded.has(n.id) &&
            !n.state.locked &&
            n.id !== node.parentId &&
            (!pq ||
              labelOf(adapter, n).toLowerCase().includes(pq) ||
              n.groupPath.some((g) => g.toLowerCase().includes(pq)) ||
              tagsOf(adapter, n).some((t) => t.toLowerCase().includes(pq))),
        )
        .slice(0, 50)
    : []

  const close = () => {
    select(null)
    setEditing(null)
  }

  const save = () => {
    if (LABEL_FIELD && !(drafts[LABEL_FIELD.key] ?? '').trim()) {
      useWorld.getState().toast(`${LABEL_FIELD.label} is required`)
      labelRef.current?.focus()
      return
    }
    const patch: Record<string, unknown> = {}
    for (const f of EDITABLE) {
      const raw = drafts[f.key] ?? ''
      patch[f.key] =
        f.kind === 'tags'
          ? raw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : f.kind === 'text'
            ? raw.trim()
            : raw
    }
    updateNode(node.id, patch)
    setEditing(null)
  }

  const cancel = () => {
    if (dirty) {
      setDiscarding(true)
      return
    }
    setEditing(null)
  }

  const dirty = editing && EDITABLE.some((f) => (drafts[f.key] ?? '') !== fieldDraft(f, node))

  const nodeTime = timeField ? timeOf(adapter, node) : undefined

  return (
    <div className="detail-panel" style={{ borderColor: palette.nodeColor(node) }}>
      <button className="detail-close" onClick={close}>
        ×
      </button>
      <div className="detail-crumb" style={{ color: palette.nodeColor(node) }}>
        {node.groupPath.join(' / ')}
        {ancestors.length > 0 && (
          <span className="detail-ancestors">
            {ancestors.map((a) => (
              <span key={a.id}>
                {' / '}
                <button className="detail-ancestor-link" onClick={() => select(a.id)}>
                  {a.label}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>

      {node.state.locked && <div className="detail-locked-banner">🔒 Locked — unlock to edit</div>}

      {editing ? (
        <div className="detail-edit">
          {EDITABLE.map((f) =>
            f.kind === 'multiline' ? (
              <textarea
                key={f.key}
                className="detail-textarea"
                value={drafts[f.key] ?? ''}
                placeholder={f.placeholder}
                rows={6}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
                  if (e.key === 'Escape') cancel()
                }}
              />
            ) : (
              <input
                key={f.key}
                ref={f === LABEL_FIELD ? labelRef : undefined}
                className="detail-input"
                value={drafts[f.key] ?? ''}
                placeholder={f.kind === 'text' ? f.label : f.placeholder}
                autoFocus={f === LABEL_FIELD}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape') cancel()
                }}
              />
            ),
          )}
          <div className="detail-actions">
            <button className="detail-btn primary" onClick={save} disabled={!dirty}>
              Save
            </button>
            <button className="detail-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
          {discarding && (
            <div className="confirm-row">
              <span>Discard unsaved changes?</span>
              <button className="detail-btn danger" onClick={() => setEditing(null)}>
                Discard
              </button>
              <button className="detail-btn" onClick={() => setDiscarding(false)}>
                Keep editing
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <h2 className="detail-title">{labelOf(adapter, node)}</h2>
          <p className="detail-body">
            {bodyOf(adapter, node) || <span className="detail-empty">no content yet</span>}
          </p>
          <div className="detail-tags">
            {tagsOf(adapter, node).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          {timeField && nodeTime !== undefined && timeDomain && (
            <div className="detail-date">
              {timeField.label.toLowerCase()} {formatTimeValue(nodeTime, timeDomain)}
            </div>
          )}

          <div className="detail-parent">
            <span className="detail-parent-label">parent</span>
            {parentNode ? (
              <button className="detail-ancestor-link" onClick={() => select(parentNode.id)}>
                {labelOf(adapter, parentNode)}
              </button>
            ) : (
              <span className="detail-parent-root">root {adapter.noun}</span>
            )}
            {!node.state.locked && (
              <button
                className="detail-btn detail-parent-change"
                title={`Re-parent this ${adapter.noun} under another, or promote it to a root`}
                onClick={() => setPicking((v) => !v)}
              >
                {picking ? 'Close' : 'Change…'}
              </button>
            )}
          </div>

          {picking && !node.state.locked && (
            <div className="parent-picker">
              <input
                className="detail-input"
                placeholder={`Search new parent by ${adapter.noun}, group, tag…`}
                value={parentQuery}
                autoFocus
                onChange={(e) => setParentQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setPicking(false)
                }}
              />
              <div className="parent-picker-list">
                {node.parentId && (
                  <button
                    className="parent-option"
                    onClick={() => {
                      promoteNode(node.id)
                      setPicking(false)
                    }}
                  >
                    <span className="parent-option-title">⌖ Make root {adapter.noun}</span>
                    <span className="parent-option-crumb">break the parent link</span>
                  </button>
                )}
                {parentCandidates.map((c) => (
                  <button
                    key={c.id}
                    className="parent-option"
                    onClick={() => {
                      reparentNode(node.id, c.id)
                      setPicking(false)
                    }}
                  >
                    <span className="parent-option-title">{labelOf(adapter, c)}</span>
                    <span className="parent-option-crumb">
                      {c.groupPath.join(' / ')}
                    </span>
                  </button>
                ))}
                {parentCandidates.length === 0 && (
                  <div className="detail-empty">no matching {adapter.noun}s</div>
                )}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div className="detail-children">
              <div className="detail-children-title">children · {children.length}</div>
              {children.map((c) => {
                const grandkids = world.childrenByParent.get(c.id)?.length ?? 0
                return (
                  <button key={c.id} className="detail-child-row" onClick={() => select(c.id)}>
                    <span className="detail-child-name">
                      {c.state.locked ? '🔒 ' : ''}
                      {labelOf(adapter, c)}
                    </span>
                    {grandkids > 0 && <span className="detail-child-count">▸ {grandkids}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {connections.length > 0 && (
            <div className="detail-children">
              <div className="detail-children-title">connections · {connections.length}</div>
              {confirmedConnections.map(({ edge, other }) => (
                <div key={edge.id} className="detail-child-row">
                  <button className="detail-ancestor-link" onClick={() => select(other.id)}>
                    {labelOf(adapter, other)}
                  </button>
                  {edge.label && (
                    <span className="parent-option-crumb">{edge.label}</span>
                  )}
                  <span className="parent-option-crumb">
                    {other.groupPath.join(' / ')}
                  </span>
                  <button
                    className="detail-btn detail-parent-change"
                    title="Remove this confirmed connection"
                    onClick={() => unlinkEdge(edge.id)}
                  >
                    Unlink
                  </button>
                </div>
              ))}
              {suggestedConnections.map(({ edge, other }) => (
                <div key={edge.id} className="detail-child-row">
                  <button
                    className="detail-ancestor-link"
                    title="Machine suggestion — confirm to keep it"
                    onClick={() => select(other.id)}
                  >
                    ⤳ {labelOf(adapter, other)}
                  </button>
                  <span className="parent-option-crumb">
                    {other.groupPath.join(' / ')}
                  </span>
                  {!node.state.locked && (
                    <button
                      className="detail-btn detail-parent-change"
                      title="Confirm this suggested connection"
                      onClick={() => confirmEdge(edge)}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="detail-actions">
            <button
              className="detail-btn"
              title={node.state.locked ? 'Unlock (L)' : 'Lock (L)'}
              onClick={() => toggleLock(node.id)}
            >
              {node.state.locked ? '🔒 Unlock' : '🔓 Lock'}
            </button>
            {!node.state.locked && (
              <>
                <button className="detail-btn" title="Edit (double-click card)" onClick={() => setEditing(node.id)}>
                  ✎ Edit
                </button>
                <button className="detail-btn" title={`Add a child ${adapter.noun} (C)`} onClick={() => addChild(node.id)}>
                  ＋ Child
                </button>
                {node.state.placed && (
                  <button
                    className="detail-btn"
                    title={node.parentId ? "Return this node to its parent's orbit" : 'Return this node to its cluster'}
                    onClick={() => resetToGrid(node.id)}
                  >
                    ⌖→🏠 {node.parentId ? 'Orbit' : 'Cluster'}
                  </button>
                )}
                <button className="detail-btn danger" onClick={() => setConfirming(true)}>
                  🗑 Delete
                </button>
              </>
            )}
          </div>

          {confirming && !node.state.locked && (
            <div className="confirm-row">
              <span>
                {doomedCount > 1
                  ? `Delete this ${adapter.noun} and ${doomedCount - 1} descendants?`
                  : `Delete this ${adapter.noun}?`}
              </span>
              <button className="detail-btn danger" onClick={() => removeNode(node.id)}>
                Delete
              </button>
              <button className="detail-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
