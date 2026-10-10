import { useState, useRef } from 'react'
import { useDesignStore } from '@/store/useDesignStore'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useContextMenuStore } from '@/store/useContextMenuStore'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Image,
  Square,
  FileCode,
  Paintbrush,
  Trash2,
  Copy,
  Group,
  ChevronDown,
  ChevronRight,
  Frame as FrameIcon,
  Plus,
  FileText,
  Pencil,
  ArrowUp,
  ArrowDown,
  GripVertical,
  MoreHorizontal,
} from 'lucide-react'
import type { LayerType } from '@/types/design'
import type { Page } from '@/types/workspace'

const LAYER_ICONS: Record<LayerType, React.ElementType> = {
  background: Paintbrush,
  text: Type,
  image: Image,
  svg: FileCode,
  shape: Square,
  gradient: Paintbrush,
  group: Group,
  draw: Pencil,
}

export function LayerListPanel() {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const activeFrameId = useWorkspaceStore((s) => s.activeFrameId)
  const setActiveFrame = useWorkspaceStore((s) => s.setActiveFrame)
  const duplicateFrame = useWorkspaceStore((s) => s.duplicateFrame)
  const removeFrame = useWorkspaceStore((s) => s.removeFrame)
  const renameFrame = useWorkspaceStore((s) => s.renameFrame)
  const addFrame = useWorkspaceStore((s) => s.addFrame)
  const addPage = useWorkspaceStore((s) => s.addPage)
  const removePage = useWorkspaceStore((s) => s.removePage)
  const renamePage = useWorkspaceStore((s) => s.renamePage)
  const setActivePage = useWorkspaceStore((s) => s.setActivePage)

  // Design store for current editing (backwards compat)
  const designLayers = useDesignStore((s) => s.document.layers)
  const selectedLayerIds = useDesignStore((s) => s.selectedLayerIds)
  const activeLayerId = useDesignStore((s) => s.activeLayerId)
  const selectLayer = useDesignStore((s) => s.selectLayer)
  const updateLayer = useDesignStore((s) => s.updateLayer)
  const removeLayer = useDesignStore((s) => s.removeLayer)
  const removeLayers = useDesignStore((s) => s.removeLayers)
  const duplicateLayer = useDesignStore((s) => s.duplicateLayer)
  const pushSnapshot = useDesignStore((s) => s.pushSnapshot)

  const reorderLayer = useDesignStore((s) => s.reorderLayer)
  const reorderSelection = useDesignStore((s) => s.reorderSelection)

  const [collapsedFrames, setCollapsedFrames] = useState<Set<string>>(new Set())
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  // Double-click a layer name to rename it (mirrors page/frame rename).
  const layerRename = (layer: { id: string; name: string }) => ({
    editing: editingId === `layer-${layer.id}`,
    value: editValue,
    onChange: setEditValue,
    onStart: () => { setEditingId(`layer-${layer.id}`); setEditValue(layer.name) },
    onCommit: () => { if (editValue.trim() && editValue.trim() !== layer.name) { pushSnapshot(); updateLayer(layer.id, { name: editValue.trim() }) }; setEditingId(null) },
    onCancel: () => setEditingId(null),
  })

  // Right-click a layer row → shared context menu. Mirrors the canvas layer
  // menu (PreviewPanel) so both surfaces offer the same actions; Rename reuses
  // the inline-rename flow above rather than a separate dialog.
  const openMenu = useContextMenuStore((s) => s.openMenu)
  const openLayerMenu = (e: React.MouseEvent, layer: (typeof designLayers)[number]) => {
    e.preventDefault()
    e.stopPropagation()
    selectLayer(layer.id)
    const isBg = layer.type === 'background'
    openMenu(e.clientX, e.clientY, [
      { id: 'rename', label: 'Rename', icon: Pencil, action: () => { setEditingId(`layer-${layer.id}`); setEditValue(layer.name) } },
      ...(isBg ? [] : [{ id: 'dup', label: 'Duplicate', icon: Copy, action: () => duplicateLayer(layer.id) }]),
      { id: 'vis', label: layer.visible ? 'Hide' : 'Show', icon: layer.visible ? EyeOff : Eye, action: () => updateLayer(layer.id, { visible: !layer.visible }) },
      { id: 'lock', label: layer.locked ? 'Unlock' : 'Lock', icon: layer.locked ? Unlock : Lock, action: () => updateLayer(layer.id, { locked: !layer.locked }) },
      ...(isBg ? [] : [
        { id: 'fwd', label: 'Bring forward', icon: ArrowUp, separatorBefore: true, action: () => reorderSelection([layer.id], 'forward') },
        { id: 'bwd', label: 'Send backward', icon: ArrowDown, action: () => reorderSelection([layer.id], 'backward') },
        { id: 'del', label: 'Delete', icon: Trash2, danger: true, separatorBefore: true, action: () => { pushSnapshot(); removeLayer(layer.id) } },
      ]),
    ])
  }

  // Layer drag-to-reorder (operates on the active frame's design-store layers).
  const [dragLayerId, setDragLayerId] = useState<string | null>(null)
  const touchDragRef = useRef<{ id: string; targetId: string | null; pos: 'above' | 'below' } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'above' | 'below' } | null>(null)

  const moveLayerTo = (id: string, targetId: string, pos: 'above' | 'below') => {
    if (id === targetId) return
    const layers = useDesignStore.getState().document.layers
    const target = layers.find(l => l.id === targetId)
    const dragged = layers.find(l => l.id === id)
    if (!target || !dragged || dragged.type === 'background' || target.type === 'background') return
    // Reorder relative to actual neighboring z indices, not an arbitrary half-step.
    const ordered = layers.filter(l => l.type !== 'background' && l.id !== id).sort((a,b) => b.zIndex - a.zIndex)
    const index = ordered.findIndex(l => l.id === targetId)
    const insertAt = index + (pos === 'below' ? 1 : 0)
    const before = ordered[insertAt - 1]
    const after = ordered[insertAt]
    const z = before && after ? (before.zIndex + after.zIndex) / 2 : before ? before.zIndex - 1 : after ? after.zIndex + 1 : 1
    reorderLayer(id, z)
  }
  const finishLayerReorder = () => {
    if (dragLayerId && dropTarget && dragLayerId !== dropTarget.id) {
      moveLayerTo(dragLayerId, dropTarget.id, dropTarget.pos)
    }
    setDragLayerId(null)
    setDropTarget(null)
  }

  const toggleGroup = (groupId: string) =>
    setCollapsedGroups((p) => { const n = new Set(p); n.has(groupId) ? n.delete(groupId) : n.add(groupId); return n })

  // Select every member of a group as one unit (Shift toggles the whole group).
  const selectGroup = (members: { id: string }[], additive: boolean) => {
    useDesignStore.setState((s) => {
      const next = additive ? new Set(s.selectedLayerIds) : new Set<string>()
      const allIn = members.every((m) => s.selectedLayerIds.has(m.id))
      for (const m of members) {
        if (additive && allIn) next.delete(m.id)
        else next.add(m.id)
      }
      return { selectedLayerIds: next, activeLayerId: members[members.length - 1]?.id ?? null }
    })
  }

  // Collapse the flat layer list into rows, folding groupId-tagged layers into a
  // single group row positioned where their topmost member sits in the z-order.
  type Row =
    | { kind: 'layer'; layer: (typeof designLayers)[number] }
    | { kind: 'group'; groupId: string; members: (typeof designLayers)[number][] }
  const buildRows = (sorted: typeof designLayers): Row[] => {
    const done = new Set<string>()
    const rows: Row[] = []
    for (const l of sorted) {
      if (done.has(l.id)) continue
      if (l.groupId) {
        const members = sorted.filter((m) => m.groupId === l.groupId)
        members.forEach((m) => done.add(m.id))
        rows.push({ kind: 'group', groupId: l.groupId, members })
      } else {
        done.add(l.id)
        rows.push({ kind: 'layer', layer: l })
      }
    }
    return rows
  }

  const renderTree = (sorted: typeof designLayers, baseIndent: number, reorderActive: boolean) =>
    buildRows(sorted).map((row) => {
      if (row.kind === 'layer') {
        const layer = row.layer
        const canReorder = reorderActive && layer.type !== 'background'
        return (
          <LayerRow
            key={layer.id}
            layer={layer}
            indentPx={baseIndent}
            rename={layerRename(layer)}
            isSelected={selectedLayerIds.has(layer.id)}
            isActive={activeLayerId === layer.id}
            onSelect={(e) => selectLayer(layer.id, e.shiftKey)}
            onContextMenu={(e) => openLayerMenu(e, layer)}
            onVisibility={() => { pushSnapshot(); updateLayer(layer.id, { visible: !layer.visible }) }}
            onLock={() => { pushSnapshot(); updateLayer(layer.id, { locked: !layer.locked }) }}
            onDuplicate={layer.type !== 'background' ? () => duplicateLayer(layer.id) : undefined}
            onDelete={layer.type !== 'background' ? () => removeLayer(layer.id) : undefined}
            reorderEnabled={canReorder}
            onTouchReorder={canReorder ? (phase, id, y) => {
              if (phase === 'start') {
                touchDragRef.current = { id, targetId: null, pos: 'above' }
                setDragLayerId(id)
              } else if (phase === 'move') {
                const hit = document.elementFromPoint(Math.min(window.innerWidth - 20, Math.max(20, (document.querySelector('[data-layer-row]')?.getBoundingClientRect().left ?? 0) + 55)), y)?.closest('[data-layer-row]') as HTMLElement | null
                const targetId = hit?.dataset.layerRow ?? null
                if (touchDragRef.current && targetId && targetId !== id) {
                  const rect = hit!.getBoundingClientRect()
                  const pos = y < rect.top + rect.height / 2 ? 'above' : 'below'
                  touchDragRef.current.targetId = targetId
                  touchDragRef.current.pos = pos
                  setDropTarget({ id: targetId, pos })
                }
              } else {
                const drag = touchDragRef.current
                if (phase === 'end' && drag?.targetId) moveLayerTo(drag.id, drag.targetId, drag.pos)
                touchDragRef.current = null
                setDragLayerId(null)
                setDropTarget(null)
              }
            } : undefined}
            onMoveForward={canReorder ? () => reorderSelection([layer.id], 'forward') : undefined}
            onMoveBackward={canReorder ? () => reorderSelection([layer.id], 'backward') : undefined}
            isDragging={dragLayerId === layer.id}
            dropPos={dropTarget?.id === layer.id ? dropTarget.pos : null}
            onDragStartLayer={canReorder ? () => setDragLayerId(layer.id) : undefined}
            onDragOverLayer={canReorder ? (pos) => {
              if (dragLayerId && dragLayerId !== layer.id) {
                setDropTarget({ id: layer.id, pos })
              }
            } : undefined}
            onDropLayer={canReorder ? finishLayerReorder : undefined}
            onDragEndLayer={canReorder ? () => { setDragLayerId(null); setDropTarget(null) } : undefined}
          />
        )
      }

      const { groupId, members } = row
      const expanded = !collapsedGroups.has(groupId)
      const anyVisible = members.some((m) => m.visible)
      const allLocked = members.every((m) => m.locked)
      return (
        <div key={`group-${groupId}`}>
          <GroupHeaderRow
            indentPx={baseIndent}
            count={members.length}
            expanded={expanded}
            selected={members.every((m) => selectedLayerIds.has(m.id))}
            anyVisible={anyVisible}
            allLocked={allLocked}
            onToggle={() => toggleGroup(groupId)}
            onSelect={(e) => selectGroup(members, e.shiftKey)}
            onVisibility={() => { pushSnapshot(); members.forEach((m) => updateLayer(m.id, { visible: !anyVisible })) }}
            onLock={() => { pushSnapshot(); members.forEach((m) => updateLayer(m.id, { locked: !allLocked })) }}
            onDelete={() => removeLayers(members.map((m) => m.id))}
          />
          {expanded && members.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              indentPx={baseIndent + 18}
              rename={layerRename(layer)}
              isSelected={selectedLayerIds.has(layer.id)}
              isActive={activeLayerId === layer.id}
              onSelect={(e) => selectLayer(layer.id, e.shiftKey)}
              onContextMenu={(e) => openLayerMenu(e, layer)}
              onVisibility={() => { pushSnapshot(); updateLayer(layer.id, { visible: !layer.visible }) }}
              onLock={() => { pushSnapshot(); updateLayer(layer.id, { locked: !layer.locked }) }}
              onDuplicate={layer.type !== 'background' ? () => duplicateLayer(layer.id) : undefined}
              onDelete={layer.type !== 'background' ? () => removeLayer(layer.id) : undefined}
              reorderEnabled={false}
            />
          ))}
        </div>
      )
    })

  const activePage = workspace.pages.find((p) => p.id === workspace.activePageId)
  const sortedDesignLayers = [...designLayers].sort((a, b) => b.zIndex - a.zIndex)

  return (
    <div className="flex flex-col h-full">
      {/* Pages — vertical list */}
      <div className="border-b border-border shrink-0 px-3 py-2 space-y-0.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60 font-medium">Pages</span>
          <button
            className="p-1 hover:bg-muted rounded-[3px] text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => addPage()}
            title="Add Page"
            aria-label="Add page"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {workspace.pages.map((page) => {
          const isActive = page.id === workspace.activePageId
          return (
            <div
              key={page.id}
              className={`
                group flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer transition-colors
                ${isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/50'}
              `}
              onClick={() => setActivePage(page.id)}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />

              {editingId === `page-${page.id}` ? (
                <input
                  className="flex-1 text-[13px] bg-white text-foreground border border-border rounded-[3px] px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => { if (editValue.trim()) renamePage(page.id, editValue.trim()); setEditingId(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (editValue.trim()) renamePage(page.id, editValue.trim()); setEditingId(null) }; if (e.key === 'Escape') setEditingId(null) }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className="text-[13px] truncate flex-1"
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(`page-${page.id}`); setEditValue(page.name) }}
                >
                  {page.name}
                </span>
              )}

              {/* Delete page (only if more than one page) */}
              {workspace.pages.length > 1 && (
                <button
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-destructive cursor-pointer transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removePage(page.id) }}
                  title="Delete page"
                  aria-label="Delete page"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Layer content for active page */}
      <div className="flex-1 overflow-y-auto">
        {activePage && (
          <>
            {/* Frames within this page */}
            {activePage.frames.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60 font-medium">Frames</span>
                  <button
                    className="p-1 hover:bg-muted rounded-[3px] text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => addFrame()}
                    title="Add Frame"
                    aria-label="Add frame"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {activePage.frames.map((frame) => {
                  const isActive = activeFrameId === frame.id
                  const isCollapsed = collapsedFrames.has(frame.id)
                  const sortedLayers = [...frame.layers].sort((a, b) => b.zIndex - a.zIndex)

                  return (
                    <div key={frame.id}>
                      {/* Frame header */}
                      <div
                        className={`
                          group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-[3px] transition-colors
                          ${isActive ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/30'}
                        `}
                        onClick={() => {
                          // The active-frame subscription in EditorView loads
                          // this frame into the design store for the canvas.
                          setActiveFrame(frame.id)
                        }}
                      >
                        <button
                          className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setCollapsedFrames((p) => { const n = new Set(p); n.has(frame.id) ? n.delete(frame.id) : n.add(frame.id); return n }) }}
                          aria-label={isCollapsed ? 'Expand frame' : 'Collapse frame'}
                        >
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <FrameIcon className="w-4 h-4 text-primary/60 shrink-0" />

                        {editingId === `frame-${frame.id}` ? (
                          <input
                            className="flex-1 text-[13px] font-medium text-foreground bg-white border border-border rounded-[3px] px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => { if (editValue.trim()) renameFrame(frame.id, editValue.trim()); setEditingId(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { if (editValue.trim()) renameFrame(frame.id, editValue.trim()); setEditingId(null) }; if (e.key === 'Escape') setEditingId(null) }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="text-[13px] font-medium text-foreground truncate flex-1"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(`frame-${frame.id}`); setEditValue(frame.name) }}
                          >
                            {frame.name}
                          </span>
                        )}

                        <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">{frame.width}x{frame.height}</span>

                        <div className="flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                          <button className="p-1 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); duplicateFrame(frame.id) }} title="Duplicate" aria-label="Duplicate frame">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {activePage.frames.length > 1 && (
                            <button className="p-1 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-destructive cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); removeFrame(frame.id) }} title="Delete" aria-label="Delete frame">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Frame's layers — grouped layers fold into expandable rows.
                          Reorder only the active frame (its layers mirror the design store). */}
                      {!isCollapsed && renderTree(sortedLayers, 40, isActive)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* If no frames (scratchpad mode), show layers from design store */}
            {activePage.frames.length === 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/60 font-medium">Layers</span>
                  <button
                    className="p-1 hover:bg-muted rounded-[3px] text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => addFrame()}
                    title="Add Frame"
                    aria-label="Add frame"
                  >
                    <FrameIcon className="w-3 h-3" />
                  </button>
                </div>
                {renderTree(sortedDesignLayers, 16, true)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// --- Layer row component ---

function LayerRow({
  layer,
  isSelected,
  isActive,
  indentPx,
  onSelect,
  onVisibility,
  onLock,
  onDuplicate,
  onDelete,
  reorderEnabled = false,
  isDragging = false,
  dropPos = null,
  onDragStartLayer,
  onDragOverLayer,
  onDropLayer,
  onDragEndLayer,
  onContextMenu,
  onMoveForward,
  onMoveBackward,
  onTouchReorder,
  rename,
}: {
  layer: any
  isSelected: boolean
  isActive: boolean
  indentPx: number
  onSelect: (e: React.MouseEvent) => void
  onVisibility: () => void
  onLock: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  reorderEnabled?: boolean
  isDragging?: boolean
  dropPos?: 'above' | 'below' | null
  onDragStartLayer?: () => void
  onDragOverLayer?: (pos: 'above' | 'below') => void
  onDropLayer?: () => void
  onDragEndLayer?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onMoveForward?: () => void
  onMoveBackward?: () => void
  onTouchReorder?: (phase: 'start' | 'move' | 'end' | 'cancel', id: string, y: number) => void
  rename?: {
    editing: boolean
    value: string
    onChange: (v: string) => void
    onStart: () => void
    onCommit: () => void
    onCancel: () => void
  }
}) {
  const Icon = LAYER_ICONS[layer.type as LayerType] ?? Square
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)

  return (
    <div
      data-layer-row={layer.id}
      draggable={reorderEnabled && typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches}
      onDragStart={reorderEnabled ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartLayer?.() } : undefined}
      onDragOver={onDragOverLayer ? (e) => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        onDragOverLayer(e.clientY < r.top + r.height / 2 ? 'above' : 'below')
      } : undefined}
      onDrop={onDropLayer ? (e) => { e.preventDefault(); onDropLayer() } : undefined}
      onDragEnd={onDragEndLayer}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: indentPx, paddingRight: 12 }}
      className={`
        group relative flex items-center gap-2 py-3 md:py-2 cursor-pointer border-l-[3px] transition-colors
        ${isDragging ? 'opacity-40' : ''}
        ${isActive ? 'border-l-primary bg-accent/30' : isSelected ? 'border-l-primary/40 bg-accent/15' : 'border-l-transparent hover:bg-muted/50'}
      `}
      onClick={onSelect}
    >
      {dropPos === 'above' && <div className="absolute inset-x-2 -top-px h-0.5 rounded-full bg-primary pointer-events-none" />}
      {dropPos === 'below' && <div className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary pointer-events-none" />}
      {onTouchReorder && <button type="button" aria-label={`Drag to reorder ${layer.name}`} title="Hold and drag to reorder" className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground md:hidden" style={{ touchAction: 'none' }} onClick={e => e.stopPropagation()} onPointerDown={e => { if (e.pointerType === 'mouse') return; e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); onTouchReorder('start', layer.id, e.clientY) }} onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; e.preventDefault(); onTouchReorder('move', layer.id, e.clientY) }} onPointerUp={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; e.stopPropagation(); onTouchReorder('end', layer.id, e.clientY) }} onPointerCancel={e => onTouchReorder('cancel', layer.id, e.clientY)}><GripVertical className="h-5 w-5" /></button>}
      <Icon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
      {rename?.editing ? (
        <input
          className="flex-1 text-[12px] text-foreground bg-white border border-border rounded-[3px] px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring"
          value={rename.value}
          onChange={(e) => rename.onChange(e.target.value)}
          onBlur={rename.onCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') rename.onCommit(); if (e.key === 'Escape') rename.onCancel() }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-[12px] truncate flex-1 min-w-0 text-foreground/80"
          onDoubleClick={rename ? (e) => { e.stopPropagation(); rename.onStart() } : undefined}
        >
          {layer.name}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        style={{ opacity: isActive ? 1 : undefined }}>
        <button className="p-2 md:p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onVisibility() }} aria-label={layer.visible ? 'Hide layer' : 'Show layer'}>
          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button className="p-2 md:p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onLock() }} aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}>
          {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <div className="relative md:hidden">
          <button type="button" className="flex h-10 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="More layer actions" aria-expanded={mobileActionsOpen} onClick={e => { e.stopPropagation(); setMobileActionsOpen(v => !v) }}><MoreHorizontal className="h-5 w-5" /></button>
          {mobileActionsOpen && <div className="absolute right-0 top-full z-50 w-44 rounded-lg border border-border bg-card p-1 shadow-xl" onClick={e => e.stopPropagation()}>
            {rename && <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMobileActionsOpen(false); rename.onStart() }}>Rename</button>}
            {onMoveForward && <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMobileActionsOpen(false); onMoveForward() }}>Bring forward</button>}
            {onMoveBackward && <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMobileActionsOpen(false); onMoveBackward() }}>Send backward</button>}
            {onDuplicate && <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMobileActionsOpen(false); onDuplicate() }}>Duplicate</button>}
            {onDelete && <button className="w-full rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => { setMobileActionsOpen(false); onDelete() }}>Delete</button>}
          </div>}
        </div>
        {onDuplicate && <button className="hidden md:inline-flex p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground" onClick={e => { e.stopPropagation(); onDuplicate() }} aria-label="Duplicate layer"><Copy className="w-3.5 h-3.5" /></button>}
        {onDelete && <button className="hidden md:inline-flex p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-destructive" onClick={e => { e.stopPropagation(); onDelete() }} aria-label="Delete layer"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
    </div>
  )
}

// --- Group header row ---

function GroupHeaderRow({
  indentPx,
  count,
  expanded,
  selected,
  anyVisible,
  allLocked,
  onToggle,
  onSelect,
  onVisibility,
  onLock,
  onDelete,
}: {
  indentPx: number
  count: number
  expanded: boolean
  selected: boolean
  anyVisible: boolean
  allLocked: boolean
  onToggle: () => void
  onSelect: (e: React.MouseEvent) => void
  onVisibility: () => void
  onLock: () => void
  onDelete: () => void
}) {
  return (
    <div
      style={{ paddingLeft: indentPx, paddingRight: 12 }}
      className={`
        group relative flex items-center gap-1.5 py-2 cursor-pointer border-l-[3px] transition-colors
        ${selected ? 'border-l-primary/40 bg-accent/15' : 'border-l-transparent hover:bg-muted/50'}
      `}
      onClick={onSelect}
    >
      <button
        className="p-0.5 -ml-1 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer shrink-0"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        aria-label={expanded ? 'Collapse group' : 'Expand group'}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      <Group className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
      <span className="text-[12px] truncate flex-1 text-foreground/90">Group</span>
      <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">{count}</span>

      <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button className="p-2 md:p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onVisibility() }} aria-label={anyVisible ? 'Hide group' : 'Show group'}>
          {anyVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button className="p-2 md:p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onLock() }} aria-label={allLocked ? 'Unlock group' : 'Lock group'}>
          {allLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <button className="p-2 md:p-0.5 hover:bg-muted rounded-[3px] text-muted-foreground/50 hover:text-destructive cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Delete group">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
