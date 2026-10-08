import { useEffect, useState } from 'react'
import { redeemStudioHandoff, type StudioHandoff } from '@/cloud/studioHandoff'

const PARENT_ORIGIN = 'https://creators.undiscoveredone.com'
const STUDIO_ORIGIN = 'https://studio.creators.undiscoveredone.com'
const SOURCE = 'undiscovered-one-studio-auth'
type GateState = { status: 'waiting' | 'verifying' | 'authorized' | 'denied'; access?: StudioHandoff; message?: string }

/**
 * Embedded-only bootstrap. Never accept raw Supabase access tokens from postMessage.
 * A redeemed ticket is proof of eligibility, NOT a Supabase session. All protected
 * data operations still require separately authenticated server-side authorization.
 */
export function StudioAuthGate({ children }: { children: React.ReactNode }) {
  const embedded = window.parent !== window
  const [state, setState] = useState<GateState>({ status: 'waiting' })
  useEffect(() => {
    if (!embedded || window.location.origin !== STUDIO_ORIGIN) return
    let active = true
    let attempted = false
    const controller = new AbortController()
    const onMessage = (event: MessageEvent) => {
      if (!active || attempted || event.origin !== PARENT_ORIGIN || event.source !== window.parent) return
      const data = event.data
      if (!data || data.source !== SOURCE || data.type !== 'ticket' || typeof data.ticket !== 'string') return
      attempted = true
      setState({ status: 'verifying' })
      void redeemStudioHandoff(data.ticket, controller.signal).then(access => {
        if (active) {
          setState({ status: 'authorized', access })
          window.parent.postMessage({ source: SOURCE, type: 'authorized', artistId: access.artistId }, PARENT_ORIGIN)
        }
      }).catch((error: unknown) => {
        if (active && !controller.signal.aborted) setState({ status: 'denied', message: error instanceof Error ? error.message : 'Studio access failed.' })
      })
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ source: SOURCE, type: 'ready' }, PARENT_ORIGIN)
    return () => { active = false; controller.abort(); window.removeEventListener('message', onMessage) }
  }, [embedded])

  if (embedded && window.location.origin === STUDIO_ORIGIN && state.status === 'authorized') return <>{children}</>
  return <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
    <div className="max-w-md text-center">
      <h1 className="text-xl font-semibold">Undiscovered One Graphic Studio</h1>
      <p className="my-4 text-sm text-muted-foreground">{!embedded
        ? 'Open Graphic Studio from the Undiscovered One Creators Dashboard.'
        : window.location.origin !== STUDIO_ORIGIN
          ? 'Graphic Studio must be opened from its official domain.'
          : state.message ?? (state.status === 'verifying' ? 'Checking your artist access…' : 'Waiting for Creators Dashboard…')}</p>
      <a className="underline" href="https://creators.undiscoveredone.com/marketing/studio">Go to Creators Dashboard</a>
    </div>
  </main>
}
