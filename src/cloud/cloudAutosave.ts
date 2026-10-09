import type { DesignFile } from '@/types/fileSystem'
import { createCloudDesign, updateCloudDesign, type StudioCredentials } from './creatorDesigns'

/**
 * Opt-in cloud autosave engine. NEVER initialize with an embedded handoff ticket:
 * callers must supply a real authenticated Supabase access token.
 * The local file store remains the source of truth until each upload succeeds.
 */
export function createCloudAutosaver(
  auth: StudioCredentials,
  getFile: () => DesignFile | undefined,
  onSaved: (cloudId: string) => void,
  onError: (error: Error) => void,
  initialCloudId?: string,
) {
  let cloudId = initialCloudId
  let stopped = false
  let dirty = false
  let busy = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastSavedFingerprint = ''

  async function flush() {
    if (stopped || busy || !dirty) return
    const file = getFile()
    if (!file || file.isScratchpad) return
    const fingerprint = JSON.stringify({ name: file.name, pages: file.pages, folderId: file.folderId })
    if (fingerprint === lastSavedFingerprint) { dirty = false; return }
    dirty = false
    busy = true
    try {
      const saved = cloudId
        ? await updateCloudDesign(auth, cloudId, file)
        : await createCloudDesign(auth, file)
      cloudId = saved.id
      lastSavedFingerprint = fingerprint
      if (!stopped) onSaved(saved.id)
    } catch (cause) {
      dirty = true
      if (!stopped) onError(cause instanceof Error ? cause : new Error('Cloud save failed'))
    } finally {
      busy = false
      // If edits arrived during the request, queue another save, without overlap.
      if (dirty && !stopped && lastSavedFingerprint) schedule()
    }
  }

  function schedule() {
    if (stopped) return
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = undefined; void flush() }, 2000)
  }

  return {
    markChanged: schedule,
    flush,
    getCloudId: () => cloudId,
    stop() {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}
