import { studioOAuthClientId, type StudioOAuthTokens } from '@/cloud/studioOAuth'

const TOKEN_URL = 'https://pqinsgsatlsofpstdaie.supabase.co/auth/v1/oauth/token'
const STORAGE_KEY = 'uo.studio.oauth.session'
type StoredSession = { tokens: StudioOAuthTokens; expiresAt: number }

/** Studio-only session. Session storage is tab-scoped; never store in URLs or localStorage. */
export function saveStudioSession(tokens: StudioOAuthTokens): void {
  if (!tokens.access_token) throw new Error('Missing Studio access token')
  const expiresIn = Number(tokens.expires_in)
  const expiresAt = Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300) * 1000
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tokens, expiresAt } satisfies StoredSession))
}

export function clearStudioSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export async function getStudioAccessToken(): Promise<string | null> {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  let session: StoredSession
  try { session = JSON.parse(raw) as StoredSession } catch { clearStudioSession(); return null }
  if (!session.tokens?.access_token || !Number.isFinite(session.expiresAt)) { clearStudioSession(); return null }
  if (Date.now() < session.expiresAt - 60_000) return session.tokens.access_token
  if (!session.tokens.refresh_token) { clearStudioSession(); return null }
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: studioOAuthClientId(),
        refresh_token: session.tokens.refresh_token,
      }),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Studio session refresh failed')
    const tokens = await response.json() as StudioOAuthTokens
    if (!tokens.access_token) throw new Error('No access token returned')
    saveStudioSession({ ...tokens, refresh_token: tokens.refresh_token ?? session.tokens.refresh_token })
    return tokens.access_token
  } catch {
    clearStudioSession()
    return null
  }
}
