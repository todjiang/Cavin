import { useEffect, useRef, useState } from 'react'
import { deletableSubtree } from '../data/layout'
import type { LaidOutNode } from '../data/layout'
import { labelOf, bodyOf, tagsOf } from '../core/accessors'
import type { FieldDescriptor } from '../core/schema'
import { knowledgeAdapter } from '../demo/adapter'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'

/** The edit form is generated from the adapter's editable field descriptors. */
const EDITABLE = knowledgeAdapter.fields.filter((f) => f.kind !== 'readonly')
/** The first text-kind field is the label field — required, autofocused. */
const LABEL_FIELD = EDITABLE.find((f) => f.kind === 'text')

/** A field's current value as edit-draft text (tags are comma-joined). */
function fieldDraft(f: FieldDescriptor, node: LaidOutNode): string {
  const v = (node as unknown as Record<string, unknown>)[f.key]
  if (f.kind === 'tags') return Array.isArray(v) ? (v as string[]).join(', ') : ''
  return typeof v === 'string' ? v : ''
}

/**
 * Right-side panel for the selected note. View mode shows content, the
 * ancestor path for nested notes, a parent row with a searchable re-parent
 * picker (or promote-to-root), a clickable children list, and the action
 * row (lock, edit, add-child, reset-to-grid/orbit, delete with cascade-aware
 * inline confirm); edit mode swaps in form fields. Locked notes render
 * read-only behind a banner — the store guards every mutation, so nothing
 * here can bypass the lock.
 */
export function DetailPanel() {
  const selectedId = useViewStore((s) => s.selectedId)
  const select = useViewStore((s) => s.select)
  const world = useWorldStore((s) => s.world)
  const editingId = useWorldStore((s) => s.editingId)
  const setEditing = useWorldStore((s) => s.setEditing)
  const updateNode = useWorldStore((s) => s.updateNode)
  const removeNode = useWorldStore((s) => s.removeNode)
  const toggleLock = useWorldStore((s) => s.toggleLock)
  const resetToGrid = useWorldStore((s) => s.resetToGrid)
  const addChild = useWorldStore((s) => s.addChild)
  const reparentNode = useWorldStore((s) => s.reparentNode)
  const promoteNode = useWorldStore((s) => s.promoteNode)
  const confirmEdge = useWorldStore((s) => s.confirmEdge)
  const unlinkEdge = useWorldStore((s) => s.unlinkEdge)

  const node = selectedId ? world.nodeById.get(selectedId) : undefined
  const editing = !!node && editingId === node.id

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [parentQuery, setParentQuery] = useState('')
  const labelRef = useRef<HTMLInputElement>(null)

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
      ancestors.unshift({ id: parent.id, label: labelOf(knowledgeAdapter, parent) })
      cur = parent
    }
  }

  const children = world.childrenByParent.get(node.id) ?? []
  const doomedCount = confirming ? deletableSubtree(world, node.id).size : 0
  const parentNode = node.parentId ? world.nodeById.get(node.parentId) : undefined

  // Cross-domain connections touching this note: confirmed first, then the
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
            !n.locked &&
            n.id !== node.parentId &&
            (!pq ||
              labelOf(knowledgeAdapter, n).toLowerCase().includes(pq) ||
              (n.groupPath ?? []).some((g) => g.toLowerCase().includes(pq)) ||
              tagsOf(knowledgeAdapter, n).some((t) => t.toLowerCase().includes(pq))),
        )
        .slice(0, 50)
    : []

  const close = () => {
    select(null)
    setEditing(null)
  }

  const save = () => {
    if (LABEL_FIELD && !(drafts[LABEL_FIELD.key] ?? '').trim()) {
      useWorldStore.getState().toast(`${LABEL_FIELD.label} is required`)
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

  return (
    <div className="detail-panel" style={{ borderColor: node.color }}>
      <button className="detail-close" onClick={close}>
        ×
      </button>
      <div className="detail-crumb" style={{ color: node.color }}>
        {(node.groupPath ?? []).join(' / ')}
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

      {node.locked && <div className="detail-locked-banner">🔒 Locked — unlock to edit</div>}

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
          <h2 className="detail-title">{labelOf(knowledgeAdapter, node)}</h2>
          <p className="detail-body">
            {bodyOf(knowledgeAdapter, node) || <span className="detail-empty">no content yet</span>}
          </p>
          <div className="detail-tags">
            {tagsOf(knowledgeAdapter, node).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          <div className="detail-date">created {new Date(node.createdAt).toISOString().slice(0, 10)}</div>

          <div className="detail-parent">
            <span className="detail-parent-label">parent</span>
            {parentNode ? (
              <button className="detail-ancestor-link" onClick={() => select(parentNode.id)}>
                {labelOf(knowledgeAdapter, parentNode)}
              </button>
            ) : (
              <span className="detail-parent-root">root note</span>
            )}
            {!node.locked && (
              <button
                className="detail-btn detail-parent-change"
                title="Re-parent this note under another note, or promote it to a root"
                onClick={() => setPicking((v) => !v)}
              >
                {picking ? 'Close' : 'Change…'}
              </button>
            )}
          </div>

          {picking && !node.locked && (
            <div className="parent-picker">
              <input
                className="detail-input"
                placeholder="Search new parent by title, room, tag…"
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
                    <span className="parent-option-title">⌖ Make root note</span>
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
                    <span className="parent-option-title">{labelOf(knowledgeAdapter, c)}</span>
                    <span className="parent-option-crumb">
                      {(c.groupPath ?? []).join(' / ')}
                    </span>
                  </button>
                ))}
                {parentCandidates.length === 0 && (
                  <div className="detail-empty">no matching notes</div>
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
                      {c.locked ? '🔒 ' : ''}
                      {labelOf(knowledgeAdapter, c)}
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
                    {labelOf(knowledgeAdapter, other)}
                  </button>
                  {edge.label && (
                    <span className="parent-option-crumb">{edge.label}</span>
                  )}
                  <span className="parent-option-crumb">
                    {(other.groupPath ?? []).join(' / ')}
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
                    ⤳ {labelOf(knowledgeAdapter, other)}
                  </button>
                  <span className="parent-option-crumb">
                    {(other.groupPath ?? []).join(' / ')}
                  </span>
                  {!node.locked && (
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
              title={node.locked ? 'Unlock (L)' : 'Lock (L)'}
              onClick={() => toggleLock(node.id)}
            >
              {node.locked ? '🔒 Unlock' : '🔓 Lock'}
            </button>
            {!node.locked && (
              <>
                <button className="detail-btn" title="Edit (double-click card)" onClick={() => setEditing(node.id)}>
                  ✎ Edit
                </button>
                <button className="detail-btn" title="Add a child note (C)" onClick={() => addChild(node.id)}>
                  ＋ Child
                </button>
                {node.placed && (
                  <button
                    className="detail-btn"
                    title={node.parentId ? "Return this note to its parent's orbit" : 'Return this note to its room grid'}
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

          {confirming && !node.locked && (
            <div className="confirm-row">
              <span>
                {doomedCount > 1 ? `Delete this note and ${doomedCount - 1} descendants?` : 'Delete this note?'}
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
