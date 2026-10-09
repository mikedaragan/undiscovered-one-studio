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

/** Immutable cloud history. Requires a genuine Supabase user session, not a handoff ticket. */
export type CloudDesignVersion = {
  id: string
  design_id: string
  artist_id: string
  version_number: number
  title: string
  document: DesignFile
  created_by: string | null
  created_at: string
  label: string | null
  protected: boolean
  reason: 'initial' | 'autosave' | 'checkpoint' | 'restore'
}

export async function listCloudDesignVersions(auth: StudioCredentials, designId: string): Promise<CloudDesignVersion[]> {
  const url = new URL(`${API}/creator_marketing_design_versions`)
  url.searchParams.set('design_id', `eq.${designId}`)
  url.searchParams.set('artist_id', `eq.${auth.artistId}`)
  url.searchParams.set('select', 'id,design_id,artist_id,version_number,title,document,created_by,created_at,label,protected,reason')
  url.searchParams.set('order', 'version_number.desc')
  return responseJson<CloudDesignVersion[]>(await fetch(url, { headers: headers(auth), cache: 'no-store' }))
}

async function callDesignRpc<T>(auth: StudioCredentials, name: string, params: Record<string, unknown>): Promise<T> {
  return responseJson<T>(await fetch(`${API}/rpc/${name}`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(params),
    cache: 'no-store',
  }))
}

export function checkpointCloudDesign(auth: StudioCredentials, designId: string, label: string, protect = false): Promise<number> {
  return callDesignRpc<number>(auth, 'checkpoint_creator_design', {
    p_design_id: designId, p_label: label, p_protected: protect,
  })
}

/** Restoring creates a new version; the old current design remains recoverable. */
export function restoreCloudDesignVersion(auth: StudioCredentials, designId: string, versionNumber: number): Promise<number> {
  return callDesignRpc<number>(auth, 'restore_creator_design_version', {
    p_design_id: designId, p_version_number: versionNumber,
  })
}
