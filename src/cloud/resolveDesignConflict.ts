import type { DesignFile } from '@/types/fileSystem'
import type { StudioCloudDesign, StudioCloudSession } from './studioCloudApi'
import { checkpointStudioDesign, createStudioDesign, getStudioDesign, saveStudioDesign } from './studioCloudApi'
import { makeConflictRecovery } from './conflictRecovery'

export type DesignConflict={local:DesignFile;remote:StudioCloudDesign;fileId:string}
export type ConflictChoice='both'|'local'|'cloud'
export type ConflictResolution={choice:ConflictChoice;remote:StudioCloudDesign;localCopy?:DesignFile;localCopyCloudId?:string}

/** No deletions. Recheck the remote revision before a destructive decision. */
export async function resolveDesignConflict(session:StudioCloudSession,conflict:DesignConflict,choice:ConflictChoice):Promise<ConflictResolution>{
 const latest=await getStudioDesign(session,conflict.remote.id)
 if(latest.updated_at!==conflict.remote.updated_at)throw new Error('The cloud design changed again. Reload the comparison before choosing.')
 if(choice==='both'){
  const copy=makeConflictRecovery(conflict.local)
  const saved=await createStudioDesign(session,copy)
  return {choice,remote:latest,localCopy:copy,localCopyCloudId:saved.id}
 }
 if(choice==='local'){
  await checkpointStudioDesign(session,latest.id,'Before conflict resolution')
  const updated=await saveStudioDesign(session,latest.id,conflict.local,latest.updated_at)
  return {choice,remote:updated}
 }
 // Back up the device's version to cloud before replacing it locally.
 const copy=makeConflictRecovery(conflict.local)
 copy.name=conflict.local.name+' (local backup)'
 const saved=await createStudioDesign(session,copy)
 return {choice,remote:latest,localCopy:copy,localCopyCloudId:saved.id}
}
