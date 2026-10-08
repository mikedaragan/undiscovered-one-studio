import { useEffect, useState } from 'react'
import { verifyCreatorStudioAccess, type CreatorStudioAccess } from '@/cloud/creatorAccess'
import { completeStudioSignIn, startStudioSignIn } from '@/cloud/studioOAuth'
import { saveStudioSession, getStudioAccessToken, clearStudioSession } from '@/cloud/studioSession'

const PARENT_ORIGIN = 'https://creators.undiscoveredone.com'
const SOURCE = 'undiscovered-one-studio-auth'
const API_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_7EBnCrQGg-t70X-3npS1Vg_2WZyEJIe'
const STUDIO_ORIGIN = 'https://studio.creators.undiscoveredone.com'
// Standalone access remains temporarily enabled until OAuth client registration
// and the Cloudflare gateway are verified end-to-end.

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
  const callback = window.location.pathname === '/auth/callback'
  useEffect(() => {
    if (!callback) return
    let active = true
    setState({ status: 'verifying' })
    void completeStudioSignIn(window.location.search).then(async (tokens) => {
      if (!API_KEY) throw new Error('Studio publishable key is not configured')
      const access = await verifyCreatorStudioAccess(tokens.access_token, API_KEY)
      if (active) { saveStudioSession(tokens); window.history.replaceState(null, '', '/'); setState({ status: 'authorized', access }) }
    }).catch((error: unknown) => {
      if (active) setState({ status: 'denied', message: error instanceof Error ? error.message : 'Sign-in failed' })
    })
    return () => { active = false }
  }, [callback])

  useEffect(() => {
    if (embedded || callback) return
    let active = true
    void getStudioAccessToken().then(async token => {
      if (!active) return
      if (!token || !API_KEY) { setState({ status: 'waiting' }); return }
      setState({ status: 'verifying' })
      try {
        const access = await verifyCreatorStudioAccess(token, API_KEY)
        if (active) setState({ status: 'authorized', access })
      } catch (error) {
        clearStudioSession()
        if (active) setState({ status: 'denied', message: error instanceof Error ? error.message : 'Session validation failed' })
      }
    })
    return () => { active = false }
  }, [embedded, callback])

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

  if (callback) {
    if (state.status === 'authorized') return <>{children}</>
    return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6"><h1>Graphic Studio sign-in</h1><p>{state.message ?? 'Completing your sign-in…'}</p><a href="https://creators.undiscoveredone.com" className="underline">Return to Creators</a></main>
  }
  if (!embedded) {
    if (state.status === 'authorized') return <>{children}</>
    return <main className="flex min-h-dvh items-center justify-center bg-background px-6"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">Undiscovered One Graphic Studio</h1><p className="my-4 text-sm text-muted-foreground">{state.message ?? (state.status === 'verifying' ? 'Checking artist access…' : 'Sign in with your Undiscovered One account to continue.')}</p><button className="rounded-md bg-teal-600 px-4 py-2 text-white" onClick={() => { void startStudioSignIn().catch(error => setState({ status: 'denied', message: error instanceof Error ? error.message : 'Unable to sign in' })) }}>Sign in with Undiscovered One</button></div></main>
  }
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
