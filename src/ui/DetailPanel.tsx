import { useEffect, useRef, useState } from 'react'
import { deletableSubtree } from '../data/layout'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'

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

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [parentQuery, setParentQuery] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // Seed the draft fields when entering edit mode; reset confirm on selection change.
  useEffect(() => {
    setConfirming(false)
    setDiscarding(false)
    setPicking(false)
    setParentQuery('')
    if (editing && node) {
      setTitle(node.title)
      setBody(node.body)
      setTags(node.tags.join(', '))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, selectedId])

  if (!node) return null

  // Ancestor path, immediate parent first → render root-first.
  const ancestors: { id: string; title: string }[] = []
  {
    let cur = node
    let guard = 0
    while (cur.parentId && guard++ < 32) {
      const parent = world.nodeById.get(cur.parentId)
      if (!parent) break
      ancestors.unshift({ id: parent.id, title: parent.title })
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
              n.title.toLowerCase().includes(pq) ||
              n.roomName.toLowerCase().includes(pq) ||
              n.wingName.toLowerCase().includes(pq) ||
              n.tags.some((t) => t.toLowerCase().includes(pq))),
        )
        .slice(0, 50)
    : []

  const close = () => {
    select(null)
    setEditing(null)
  }

  const save = () => {
    if (!title.trim()) {
      useWorldStore.getState().toast('Title is required')
      titleRef.current?.focus()
      return
    }
    updateNode(node.id, {
      title,
      body,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
    setEditing(null)
  }

  const cancel = () => {
    if (dirty) {
      setDiscarding(true)
      return
    }
    setEditing(null)
  }

  const dirty = editing && (title !== node.title || body !== node.body || tags !== node.tags.join(', '))

  return (
    <div className="detail-panel" style={{ borderColor: node.color }}>
      <button className="detail-close" onClick={close}>
        ×
      </button>
      <div className="detail-crumb" style={{ color: node.color }}>
        {node.wingName} / {node.roomName}
        {ancestors.length > 0 && (
          <span className="detail-ancestors">
            {ancestors.map((a) => (
              <span key={a.id}>
                {' / '}
                <button className="detail-ancestor-link" onClick={() => select(a.id)}>
                  {a.title}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>

      {node.locked && <div className="detail-locked-banner">🔒 Locked — unlock to edit</div>}

      {editing ? (
        <div className="detail-edit">
          <input
            ref={titleRef}
            className="detail-input"
            value={title}
            placeholder="Title"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') cancel()
            }}
          />
          <textarea
            className="detail-textarea"
            value={body}
            placeholder="Write the note…"
            rows={6}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
              if (e.key === 'Escape') cancel()
            }}
          />
          <input
            className="detail-input"
            value={tags}
            placeholder="tags, comma, separated"
            onChange={(e) => setTags(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') cancel()
            }}
          />
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
          <h2 className="detail-title">{node.title}</h2>
          <p className="detail-body">{node.body || <span className="detail-empty">no content yet</span>}</p>
          <div className="detail-tags">
            {node.tags.map((t) => (
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
                {parentNode.title}
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
                    <span className="parent-option-title">{c.title}</span>
                    <span className="parent-option-crumb">
                      {c.wingName} / {c.roomName}
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
                      {c.title}
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
                    {other.title}
                  </button>
                  {edge.label && (
                    <span className="parent-option-crumb">{edge.label}</span>
                  )}
                  <span className="parent-option-crumb">
                    {other.wingName} / {other.roomName}
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
                    ⤳ {other.title}
                  </button>
                  <span className="parent-option-crumb">
                    {other.wingName} / {other.roomName}
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
