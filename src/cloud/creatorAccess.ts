/** Access checks use the existing Undiscovered One Supabase session.
 * No service-role key, password, or long-lived session is passed through postMessage.
 * The dashboard must arrange a secure session exchange before enabling this client.
 */
const ACCESS_URL = 'https://pqinsgsatlsofpstdaie.supabase.co/functions/v1/creator-studio-access'

export interface AuthorizedArtist {
  id: string
  name: string
  role: string
}
export interface CreatorStudioAccess {
  userId: string
  artists: AuthorizedArtist[]
}

/** Never treat client-side access checks as a replacement for RLS or an edge gateway. */
export async function verifyCreatorStudioAccess(
  accessToken: string,
  publishableKey: string,
  signal?: AbortSignal,
): Promise<CreatorStudioAccess> {
  if (!accessToken || !publishableKey) throw new Error('Sign in through Undiscovered One Creators first')
  const response = await fetch(ACCESS_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey },
    cache: 'no-store',
    signal,
  })
  if (response.status === 401) throw new Error('Your sign-in has expired. Please sign in again.')
  if (response.status === 403) throw new Error('An approved artist account is required to use Graphic Studio.')
  if (!response.ok) throw new Error('Could not verify artist access. Please try again.')
  const result = await response.json() as CreatorStudioAccess
  if (!result.userId || !Array.isArray(result.artists) || !result.artists.length) {
    throw new Error('No approved artist workspace is available.')
  }
  return result
}
