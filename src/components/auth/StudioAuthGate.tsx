import { useEffect, useState } from 'react'
import { verifyCreatorStudioAccess, type CreatorStudioAccess } from '@/cloud/creatorAccess'

const PARENT_ORIGIN = 'https://creators.undiscoveredone.com'
const SOURCE = 'undiscovered-one-studio-auth'
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const STUDIO_ORIGIN = 'https://studio.creators.undiscoveredone.com'

type State = { status: 'waiting' | 'verifying' | 'authorized' | 'denied'; access?: CreatorStudioAccess; message?: string }

/**
 * Embedded Studio bootstrap. The host must send a valid Supabase access token
 * directly to this iframe using postMessage with this iframe's exact origin.
 * Tokens are held in memory only, never in URLs, storage, logs, or analytics.
 * This does not replace the future server-side Cloudflare gateway.
 */
export function StudioAuthGate({ children }: { children: React.ReactNode }) {
  const embedded = window.parent !== window
  const trustedEmbed = embedded && document.referrer ? new URL(document.referrer).origin === PARENT_ORIGIN : embedded
  const [state, setState] = useState<State>({ status: 'waiting' })

  useEffect(() => {
    if (!embedded || !trustedEmbed || window.location.origin !== STUDIO_ORIGIN) return
    let current = 0
    const controller = new AbortController()
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== PARENT_ORIGIN) return
      const data = event.data
      if (!data || data.source !== SOURCE || data.type !== 'session' || typeof data.accessToken !== 'string') return
      const key = API_KEY
      if (!key) {
        setState({ status: 'denied', message: 'Studio authentication is not configured yet.' })
        return
      }
      const request = ++current
      setState({ status: 'verifying' })
      void verifyCreatorStudioAccess(data.accessToken, key, controller.signal)
        .then((access) => { if (request === current) setState({ status: 'authorized', access }) })
        .catch((error: unknown) => {
          if (request === current && !controller.signal.aborted) {
            setState({ status: 'denied', message: error instanceof Error ? error.message : 'Artist access could not be verified.' })
          }
        })
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ source: SOURCE, type: 'ready' }, PARENT_ORIGIN)
    return () => { ++current; controller.abort(); window.removeEventListener('message', onMessage) }
  }, [embedded, trustedEmbed])

  if (!embedded) return <>{children}</>
  if (!trustedEmbed || window.location.origin !== STUDIO_ORIGIN) return <main className="flex min-h-dvh items-center justify-center bg-background p-6">Open Studio from the Creators Dashboard.</main>
  if (state.status === 'authorized') return <>{children}</>
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Undiscovered One Graphic Studio</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {state.message ?? (state.status === 'verifying' ? 'Checking your artist permissions…' : 'Waiting for your Creators Dashboard session…')}
        </p>
        {state.status === 'denied' && <a className="mt-4 inline-block underline" href="https://creators.undiscoveredone.com">Return to Creators Dashboard</a>}
      </div>
    </main>
  )
}
