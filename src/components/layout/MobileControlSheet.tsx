import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SlidersHorizontal, Copy, Trash2, Type, Paintbrush, Move, Sparkles } from 'lucide-react'
import { Drawer, DrawerContent, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { LayerListPanel } from '@/components/panels/LayerListPanel'
import { LayerInspector } from '@/components/panels/LayerInspector'
import { useDesignStore } from '@/store/useDesignStore'
import { haptic } from '@/lib/haptics'

/**
 * Mobile-only control cluster (bottom-left corner, clearing the centred
 * FloatingToolbar). Progressive disclosure: Layers is always available; the
 * properties sheet (the desktop inspector, in a bottom drawer) appears only when
 * a layer is selected — so the canvas stays uncluttered until you ask to edit.
 */
// A round 44px action in the bottom-left selection cluster.
function ClusterButton({
  label, onClick, variant = 'default', children,
}: {
  label: string
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  children: React.ReactNode
}) {
  const tone =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground'
      : variant === 'danger'
        ? 'bg-white text-red-600'
        : 'bg-white text-foreground'
  return (
    <motion.button
      aria-label={label}
      className={`h-11 w-11 flex items-center justify-center rounded-xl transition-transform active:scale-[0.96] ${tone}`}
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: 6 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      onPointerDown={() => haptic(variant === 'danger' ? 'medium' : 'light')}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}

// iOS-style detents: a medium height and a (near) full height. Sheets open at
// medium and can be dragged up to large.
const DETENTS: number[] = [0.55, 0.92]

export function MobileControlSheet() {
  const [drawer, setDrawer] = useState<'layers' | 'inspector' | null>(null)
  const [inspectorTab, setInspectorTab] = useState<'style' | 'layout' | 'effects'>('style')
  const [propSnap, setPropSnap] = useState<number | string | null>(DETENTS[0])
  const [layerSnap, setLayerSnap] = useState<number | string | null>(DETENTS[0])
  const openInspector = () => { setInspectorTab('style'); setPropSnap(DETENTS[0]); setDrawer('inspector') }
  const openLayers = () => { setLayerSnap(DETENTS[0]); setDrawer('layers') }
  const activeLayer = useDesignStore((s) => s.document.layers.find((l) => l.id === s.activeLayerId) ?? null)
  const selectedCount = useDesignStore((s) => s.selectedLayerIds.size)
  const editable = !!activeLayer && activeLayer.type !== 'background'
  const isText = activeLayer?.type === 'text'
  const hasSelection = selectedCount > 0
  useEffect(() => { setInspectorTab('style') }, [activeLayer?.id])
  useEffect(() => {
    const listener = () => openLayers()
    window.addEventListener('studio:open-mobile-layers', listener)
    return () => window.removeEventListener('studio:open-mobile-layers', listener)
  }, [])

  const duplicateSelection = () => {
    const s = useDesignStore.getState()
    for (const id of [...s.selectedLayerIds]) s.duplicateLayer(id)
  }
  const deleteSelection = () => {
    const s = useDesignStore.getState()
    s.pushSnapshot()
    s.removeLayers([...s.selectedLayerIds])
  }

  return (
    <>
      <AnimatePresence>
        {drawer === null && (
          <motion.div
            className="fixed bottom-[5.25rem] left-1/2 z-30 flex -translate-x-1/2 flex-row items-center gap-2 rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Selection actions — spring in only when something is selected
                (progressive disclosure): Edit properties, Duplicate, Delete. */}
            <AnimatePresence>
              {isText && activeLayer && (
                <ClusterButton key="text" label="Edit text" onClick={() => useDesignStore.getState().setEditingTextLayerId(activeLayer.id)} variant="primary">
                  <Type className="w-5 h-5" />
                </ClusterButton>
              )}
              {editable && (
                <ClusterButton key="edit" label="Edit properties" onClick={openInspector}>
                  <SlidersHorizontal className="w-5 h-5" />
                </ClusterButton>
              )}
              {hasSelection && (
                <ClusterButton key="dup" label="Duplicate" onClick={duplicateSelection}>
                  <Copy className="w-5 h-5" />
                </ClusterButton>
              )}
              {hasSelection && (
                <ClusterButton key="del" label="Delete" onClick={deleteSelection} variant="danger">
                  <Trash2 className="w-5 h-5" />
                </ClusterButton>
              )}
            </AnimatePresence>


          </motion.div>
        )}
      </AnimatePresence>

      {/* Layers drawer — opens at the medium detent, drag up to large. The body
          is flex-1/min-h-0 so the header stays pinned and scrolling works. */}
      <Drawer open={drawer === 'layers'} onOpenChange={(open) => !open && setDrawer(null)} snapPoints={DETENTS} activeSnapPoint={layerSnap} setActiveSnapPoint={setLayerSnap}>
        <DrawerContent className="mt-0 h-[92dvh] max-h-none">
          <SheetHeader title="Layers" />
          <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)] no-scrollbar">
            <LayerListPanel />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Properties drawer — the shared inspector, on demand. */}
      <Drawer open={drawer === 'inspector'} onOpenChange={(open) => !open && setDrawer(null)} snapPoints={DETENTS} activeSnapPoint={propSnap} setActiveSnapPoint={setPropSnap}>
        <DrawerContent className="mt-0 h-[92vh] max-h-none">
          <SheetHeader title={activeLayer?.name ?? 'Properties'} />
          <div role="tablist" aria-label="Property categories" className="grid grid-cols-3 gap-2 px-4 pb-3">
            {([
              { id: 'style', label: 'Style', icon: Paintbrush },
              { id: 'layout', label: 'Position', icon: Move },
              { id: 'effects', label: 'Effects', icon: Sparkles },
            ] as const).map((tab) => (
              <button key={tab.id} role="tab" aria-selected={inspectorTab === tab.id} onClick={() => setInspectorTab(tab.id)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium ${inspectorTab === tab.id ? 'bg-foreground text-background' : 'bg-muted text-foreground'}`}>
                <tab.icon className="h-4 w-4" />{tab.label}
              </button>
            ))}
          </div>
          <div className="mobile-inspector flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] no-scrollbar">
            {activeLayer ? <LayerInspector layer={activeLayer} mobileSection={inspectorTab} /> : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

// Sheet header: a visible title (also the accessible DrawerTitle) + a Done pill
// with a ≥40px hit area. Tapping down / dragging the sheet also dismisses.
function SheetHeader({ title }: { title: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-0.5">
      <DrawerTitle className="p-0 text-[16px] font-semibold text-foreground">{title}</DrawerTitle>
      <DrawerClose asChild>
        <button className="h-10 rounded-full bg-muted px-4 text-[13px] font-medium text-foreground transition-transform active:scale-[0.96]">
          Done
        </button>
      </DrawerClose>
    </div>
  )
}
