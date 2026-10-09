/** One-time bootstrap only. A ticket is not a Supabase access token or session. */
const ENDPOINT = 'https://pqinsgsatlsofpstdaie.supabase.co/functions/v1/creator-studio-handoff'
export interface StudioHandoff { userId: string; artistId: string; verified: true; sessionToken: string }
export async function redeemStudioHandoff(ticket: string, signal?: AbortSignal): Promise<StudioHandoff> {
  if (!/^[0-9a-f]{64}$/.test(ticket)) throw new Error('Invalid Studio access ticket.')
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'redeem', ticket }),
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(response.status === 403
    ? 'Your Studio ticket expired or was already used. Open Graphic Studio again from Creators.'
    : 'Could not verify your Studio ticket. Please reopen Graphic Studio from Creators.')
  const result = await response.json() as StudioHandoff
  if (!result.verified || !result.userId || !result.artistId || !/^[0-9a-f]{64}$/.test(result.sessionToken)) throw new Error('Invalid Studio verification response.')
  return result
}
