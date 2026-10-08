/**
 * Creator Studio cloud persistence adapter.
 * Uses the signed-in creator's Supabase access token; never a service-role key.
 * The dashboard integration will provide the session after a verified auth handoff.
 */
import type { DesignFile } from '@/types/fileSystem'

const API = 'https://pqinsgsatlsofpstdaie.supabase.co/rest/v1'
const TABLE = 'creator_marketing_designs'

export type CloudDesign = {
  id: string
  artist_id: string
  created_by: string
  title: string
  document: DesignFile
  updated_at: string
}

export type StudioCredentials = {
  accessToken: string
  publishableKey: string
  artistId: string
  userId: string
}

function headers(auth: StudioCredentials): HeadersInit {
  if (!auth.accessToken || !auth.publishableKey || !auth.artistId || !auth.userId) {
    throw new Error('Creator authentication is required for cloud saving')
  }
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    apikey: auth.publishableKey,
    'Content-Type': 'application/json',
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Studio cloud request failed (${response.status}): ${(await response.text()).slice(0, 250)}`)
  }
  return response.json() as Promise<T>
}

/** Artist scoping is enforced server-side by Supabase RLS, not just by this filter. */
export async function listCloudDesigns(auth: StudioCredentials): Promise<CloudDesign[]> {
  const url = new URL(`${API}/${TABLE}`)
  url.searchParams.set('artist_id', `eq.${auth.artistId}`)
  url.searchParams.set('select', 'id,artist_id,created_by,title,document,updated_at')
  url.searchParams.set('order', 'updated_at.desc')
  return responseJson<CloudDesign[]>(await fetch(url, { headers: headers(auth), cache: 'no-store' }))
}

export async function createCloudDesign(auth: StudioCredentials, file: DesignFile): Promise<CloudDesign> {
  const result = await responseJson<CloudDesign[]>(await fetch(`${API}/${TABLE}`, {
    method: 'POST',
    headers: { ...headers(auth), Prefer: 'return=representation' },
    body: JSON.stringify({
      artist_id: auth.artistId,
      created_by: auth.userId,
      title: file.name,
      document: file,
    }),
  }))
  if (!result[0]) throw new Error('Design was not returned by Supabase')
  return result[0]
}

export async function updateCloudDesign(auth: StudioCredentials, designId: string, file: DesignFile): Promise<CloudDesign> {
  const url = new URL(`${API}/${TABLE}`)
  url.searchParams.set('id', `eq.${designId}`)
  url.searchParams.set('artist_id', `eq.${auth.artistId}`)
  const result = await responseJson<CloudDesign[]>(await fetch(url, {
    method: 'PATCH',
    headers: { ...headers(auth), Prefer: 'return=representation' },
    body: JSON.stringify({ title: file.name, document: file, updated_at: new Date().toISOString() }),
  }))
  if (!result[0]) throw new Error('Design not found or creator lacks permission')
  return result[0]
}

export async function deleteCloudDesign(auth: StudioCredentials, designId: string): Promise<void> {
  const url = new URL(`${API}/${TABLE}`)
  url.searchParams.set('id', `eq.${designId}`)
  url.searchParams.set('artist_id', `eq.${auth.artistId}`)
  const response = await fetch(url, { method: 'DELETE', headers: headers(auth) })
  if (!response.ok) throw new Error(`Unable to delete design (${response.status})`)
}
