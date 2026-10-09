import { motion, AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { TemplateBrowser } from '@/components/panels/TemplateBrowser'
import { LayoutPicker } from '@/components/panels/LayoutPicker'
import { measureImportedSvg } from '@/engine/svgMeasure'
import { useDesignStore, createTextLayer } from '@/store/useDesignStore'
import { getBrandColor } from '@/brand/palette'
import { MousePointer2, Type, Square, ImageIcon, Pencil, Copy, Trash2, MoreHorizontal, Hand, Circle, Triangle, Star, Minus, ArrowRight, Palette, FileCode, MessageCircle, LayoutGrid, LayoutTemplate } from 'lucide-react'
import { haptic } from '@/lib/haptics'
import type { ComponentType } from 'react'

/**
 * Floating quick-actions bar, bottom-centre of the canvas (tldraw / Figma
 * style). Lives alongside the top ToolBar: the left group switches the primary
 * tools/creates, and a contextual right group (duplicate / delete) springs in
 * only when something is selected. Reflects and drives the same tool state as
 * the top bar, so they stay in lockstep.
 */

function addImageViaPicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      useDesignStore.getState().addLayer({
        type: 'image', name: file.name.split('.')[0] || 'Image', visible: true, locked: false, opacity: 1,
        x: 100, y: 100, width: 300, height: 300, rotation: 0,
        imageUrl: e.target?.result as string, fit: 'cover', cropX: 0, cropY: 0, cropW: 1, cropH: 1, borderRadius: 0, aspectRatioLocked: true,
      })
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function IconButton({ icon: Icon, label, active, onClick, danger }: {
  icon: ComponentType<{ className?: string }>
  label: string
  active?: boolean
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={() => haptic(danger ? 'medium' : 'light')}
      // Blur after click so the button doesn't retain focus and swallow / confuse
      // canvas keyboard shortcuts (e.g. Backspace to delete a selection).
      onClick={(e) => { e.currentTarget.blur(); onClick() }}
      className={`flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-[10px] transition-[color,background-color,transform] duration-150 active:scale-[0.96] cursor-pointer ${
        active
          ? 'bg-primary/12 text-primary'
          : danger
            ? 'text-muted-foreground hover:bg-red-50 hover:text-red-600'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  )
}

export function FloatingToolbar() {
  const tool = useDesignStore((s) => s.tool)
  const setTool = useDesignStore((s) => s.setTool)
  const addLayer = useDesignStore((s) => s.addLayer)
  const selectedCount = useDesignStore((s) => s.selectedLayerIds.size)
  const [moreOpen, setMoreOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [layoutsOpen, setLayoutsOpen] = useState(false)

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="md:hidden pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-[16px] border border-black/5 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur max-md:max-w-[calc(100vw-1.5rem)] max-md:overflow-x-auto no-scrollbar"
    >
      <IconButton icon={MousePointer2} label="Select (V)" active={tool === 'select'} onClick={() => setTool('select')} />
      <IconButton icon={Pencil} label="Draw (P)" active={tool === 'draw'} onClick={() => setTool(tool === 'draw' ? 'select' : 'draw')} />
      <IconButton icon={Type} label="Text (T)" onClick={() => addLayer(createTextLayer())} />
      <IconButton
        icon={Square}
        label="Shape (R)"
        onClick={() => addLayer({ type: 'shape', name: 'Rectangle', visible: true, locked: false, opacity: 1, x: 100, y: 100, width: 200, height: 200, rotation: 0, shape: 'rectangle', fill: getBrandColor('brand-dark'), borderRadius: 7 })}
      />
      <IconButton icon={ImageIcon} label="Image" onClick={addImageViaPicker} />
      <div className="md:hidden"><IconButton icon={MoreHorizontal} label="More tools" active={moreOpen} onClick={() => setMoreOpen(true)} /></div>

      {/* Contextual actions — spring in only when there's a selection. On mobile
          these live in the bottom-left selection cluster (MobileControlSheet)
          instead, so the toolbar stays add-tools only and never overflows. */}
      <AnimatePresence initial={false}>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, bounce: 0 }}
            className="flex items-center gap-1 overflow-hidden max-md:hidden"
          >
            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
            <IconButton icon={Copy} label="Duplicate (⌘D)" onClick={duplicateSelection} />
            <IconButton icon={Trash2} label="Delete" danger onClick={deleteSelection} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
      <DrawerContent className="md:hidden max-h-[85dvh]">
        <div className="flex items-center justify-between px-4 pb-3">
          <DrawerTitle className="text-base font-semibold">More tools</DrawerTitle>
          <DrawerClose asChild><button className="min-h-11 rounded-full bg-muted px-4 text-sm">Done</button></DrawerClose>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {[
            { heading: 'Navigate', actions: [
              { label: 'Pan canvas', icon: Hand, run: () => setTool('pan') },
              { label: 'Comments', icon: MessageCircle, run: () => setTool('comment') },
            ] },
            { heading: 'Shapes and effects', actions: [
              ...[
                { label: 'Circle', icon: Circle, shape: 'ellipse' },
                { label: 'Triangle', icon: Triangle, shape: 'triangle' },
                { label: 'Star', icon: Star, shape: 'star' },
                { label: 'Line', icon: Minus, shape: 'line' },
                { label: 'Arrow', icon: ArrowRight, shape: 'line' },
              ].map((item) => ({ label: item.label, icon: item.icon, run: () => addLayer({ type: 'shape', name: item.label, visible: true, locked: false, opacity: 1, x: 100, y: 100, width: 200, height: item.shape === 'line' ? 0 : 200, rotation: 0, shape: item.shape, fill: getBrandColor('brand-dark'), borderRadius: 0, ...(item.shape === 'line' ? { stroke: { color: getBrandColor('charcoal'), width: 3 }, lineCap: 'round' } : {}), ...(item.label === 'Arrow' ? { arrowEnd: true } : {}) }) })),
              { label: 'Gradient', icon: Palette, run: () => addLayer({ type: 'gradient', name: 'Gradient', visible: true, locked: false, opacity: 1, x: 50, y: 50, width: 500, height: 300, rotation: 0, gradientType: 'linear', angle: 135, grain: 0.1, borderRadius: 0, stops: [{ position: 0, oklchL: 0.55, oklchC: 0.2, oklchH: 265, alpha: 1 }, { position: 1, oklchL: 0.35, oklchC: 0.15, oklchH: 280, alpha: 1 }] }) },
            ] },
            { heading: 'Assets and layouts', actions: [
              { label: 'Import SVG', icon: FileCode, run: () => {
                const input = document.createElement('input')
                input.type = 'file'; input.accept = '.svg,image/svg+xml'
                input.onchange = () => {
                  const file = input.files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    try {
                      const { svgContent, width, height } = measureImportedSvg(String(event.target?.result ?? ''))
                      addLayer({ type: 'svg', name: file.name.replace(/\.svg$/i, '') || 'SVG', visible: true, locked: false, opacity: 1, x: 100, y: 100, width, height, rotation: 0, svgContent })
                    } catch { window.alert('Could not import this SVG file.') }
                  }
                  reader.readAsText(file)
                }
                input.click()
              } },
              { label: 'Layouts', icon: LayoutGrid, run: () => setLayoutsOpen(true) },
              { label: 'Templates', icon: LayoutTemplate, run: () => setTemplatesOpen(true) },
            ] },
          ].map((section) => <section key={section.heading} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.heading}</h3>
            <div className="grid grid-cols-2 gap-2">
              {section.actions.map((action) => <button key={action.label} type="button" className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm active:bg-muted" onClick={() => { setMoreOpen(false); action.run() }}>
                <action.icon className="h-5 w-5 shrink-0 text-primary" /><span>{action.label}</span>
              </button>)}
            </div>
          </section>)}
        </div>
      </DrawerContent>
    </Drawer>
    {templatesOpen && <TemplateBrowser onClose={() => setTemplatesOpen(false)} />}
    {layoutsOpen && <LayoutPicker onClose={() => setLayoutsOpen(false)} />}
    </>
  )
}
