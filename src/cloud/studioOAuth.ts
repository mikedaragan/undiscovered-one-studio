/** Supabase OAuth 2.1 public client with Authorization Code + PKCE. */
const AUTH_BASE = 'https://pqinsgsatlsofpstdaie.supabase.co/auth/v1'
export const STUDIO_CALLBACK = 'https://studio.creators.undiscoveredone.com/auth/callback'
const PENDING_KEY = 'uo.studio.oauth.pending'
const TTL_MS = 10 * 60 * 1000

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('')
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function studioOAuthClientId(): string {
  return (import.meta.env.VITE_STUDIO_OAUTH_CLIENT_ID as string | undefined)?.trim() || 'b4b14710-5d88-422e-8f4a-995a0ede1efc'
}

export async function startStudioSignIn(): Promise<void> {
  const clientId = studioOAuthClientId()
  if (!clientId) throw new Error('Graphic Studio OAuth client ID has not been configured')
  const state = randomHex(32)
  const verifier = randomHex(48)
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier, createdAt: Date.now() }))
  const url = new URL(`${AUTH_BASE}/oauth/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', STUDIO_CALLBACK)
  url.searchParams.set('scope', 'openid profile email offline_access')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  window.location.assign(url.toString())
}

export type StudioOAuthTokens = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

/** Called only on the exact registered callback URL. State is consumed before token exchange. */
export async function completeStudioSignIn(search: string): Promise<StudioOAuthTokens> {
  if (window.location.origin + window.location.pathname !== STUDIO_CALLBACK) throw new Error('Invalid OAuth callback location')
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const receivedState = params.get('state')
  const stored = sessionStorage.getItem(PENDING_KEY)
  sessionStorage.removeItem(PENDING_KEY)
  if (params.has('error')) throw new Error('Authorization was denied or could not be completed')
  if (!code || !receivedState || !stored) throw new Error('Missing authorization code or state')
  let pending: { state: string; verifier: string; createdAt: number }
  try { pending = JSON.parse(stored) as typeof pending } catch { throw new Error('Invalid authorization state') }
  if (pending.state !== receivedState || !pending.verifier || Date.now() - pending.createdAt > TTL_MS || Date.now() < pending.createdAt) {
    throw new Error('Authorization expired or state mismatch')
  }
  const clientId = studioOAuthClientId()
  if (!clientId) throw new Error('Graphic Studio OAuth client ID has not been configured')
  const response = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: pending.verifier,
      redirect_uri: STUDIO_CALLBACK,
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Could not exchange the authorization code')
  const result = await response.json() as StudioOAuthTokens
  if (!result.access_token) throw new Error('Authorization did not return an access token')
  window.history.replaceState(null, '', '/')
  return result
}
