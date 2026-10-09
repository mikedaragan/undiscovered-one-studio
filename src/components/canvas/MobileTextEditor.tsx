import { useEffect, useRef, useState } from 'react'
import { AlignLeft, AlignCenter, AlignRight, Minus, Plus } from 'lucide-react'
import { useDesignStore } from '@/store/useDesignStore'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import type { TextLayer } from '@/types/design'

/**
 * Fullscreen text editor for touch devices. Inline canvas text editing is fiddly
 * on a phone (tiny, zoom-dependent, and the keyboard covers it), so when text
 * editing starts on a coarse pointer we take over the screen with a large,
 * comfortable field. Commits through the same `editingTextLayerId` flow as the
 * desktop inline overlay (which is suppressed on touch).
 */
export function MobileTextEditor() {
  const coarse = useCoarsePointer()
  const editingId = useDesignStore((s) => s.editingTextLayerId)
  const layer = useDesignStore((s) =>
    s.document.layers.find((l) => l.id === s.editingTextLayerId),
  ) as TextLayer | undefined
  const updateLayer = useDesignStore((s) => s.updateLayer)
  const setEditing = useDesignStore((s) => s.setEditingTextLayerId)
  const pushSnapshot = useDesignStore((s) => s.pushSnapshot)

  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const [tab, setTab] = useState<'text' | 'style'>('text')
  const [keyboardInset, setKeyboardInset] = useState(0)

  // iOS Safari can keep the layout viewport tall while the keyboard shrinks
  // the visual viewport. Lift the sheet above that obscured area.
  useEffect(() => {
    if (!active) return
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [active])

  const active = coarse && !!editingId && layer?.type === 'text'

  useEffect(() => {
    if (!active || !layer) return
    setValue(layer.content)
    setTab('text')
    // Focus on the next frame so the keyboard opens and the caret lands at the end.
    const id = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
    return () => cancelAnimationFrame(id)
    // Only re-run when the edited layer changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, active])

  if (!active || !layer) return null

  const changeStyle = (patch: Partial<TextLayer>) => {
    pushSnapshot()
    updateLayer<TextLayer>(layer.id, patch)
  }

  const commit = () => {
    if (value !== layer.content) {
      pushSnapshot()
      updateLayer<TextLayer>(layer.id, { content: value })
    }
    setEditing(null)
  }

  return (
    <div className="fixed inset-x-0 z-[200] flex max-h-[65dvh] min-h-[230px] flex-col rounded-t-2xl border-t border-border bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:hidden" style={{ bottom: keyboardInset }}>
      <div className="flex items-center justify-between px-3 h-14 border-b border-border shrink-0">
        <button
          onClick={() => setEditing(null)}
          className="h-10 px-3 text-[15px] text-muted-foreground transition-transform active:scale-[0.96]"
        >
          Cancel
        </button>
        <span className="text-[15px] font-semibold text-foreground">Edit text</span>
        <button
          onClick={commit}
          className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-[14px] font-medium transition-transform active:scale-[0.96]"
        >
          Done
        </button>
      </div>
      <div className="flex gap-1 border-b border-border px-3 py-2" role="tablist" aria-label="Text editing options">
        <button type="button" role="tab" aria-selected={tab === 'text'} onClick={() => { setTab('text'); requestAnimationFrame(() => ref.current?.focus()) }} className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${tab === 'text' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>Text</button>
        <button type="button" role="tab" aria-selected={tab === 'style'} onClick={() => { setTab('style'); ref.current?.blur() }} className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${tab === 'style' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>Style</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Type your text…"
        aria-label="Text content"
        className={`min-h-[150px] h-[30dvh] max-h-[45dvh] w-full resize-none bg-transparent px-4 py-4 text-[18px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 ${tab === 'style' ? 'hidden' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      />
      {tab === 'style' && (
        <div className="flex min-h-[170px] flex-col gap-4 overflow-y-auto px-4 py-4" aria-label="Text formatting">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Font size</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Decrease font size" disabled={layer.fontSize <= 8} onClick={() => changeStyle({ fontSize: Math.max(8, layer.fontSize - 2) })} className="flex h-11 w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="min-w-12 text-center text-sm tabular-nums">{layer.fontSize}px</span>
              <button type="button" aria-label="Increase font size" disabled={layer.fontSize >= 400} onClick={() => changeStyle({ fontSize: Math.min(400, layer.fontSize + 2) })} className="flex h-11 w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Alignment</span>
            <div className="flex gap-2">
              {([{ value: 'left', Icon: AlignLeft }, { value: 'center', Icon: AlignCenter }, { value: 'right', Icon: AlignRight }] as const).map(({ value: align, Icon }) => (
                <button key={align} type="button" aria-label={`Align ${align}`} aria-pressed={layer.textAlign === align} onClick={() => changeStyle({ textAlign: align })} className={`flex h-11 w-11 items-center justify-center rounded-lg border ${layer.textAlign === align ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}><Icon className="h-5 w-5" /></button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">For color, effects, and positioning, select the text and open Properties.</p>
        </div>
      )}
    </div>
  )
}
