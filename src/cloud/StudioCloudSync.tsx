import { useEffect, useState } from 'react'
import { useStudioSession } from '@/components/auth/StudioAuthGate'
import { useFileStore } from '@/store/useFileStore'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useRouterStore } from '@/store/useRouterStore'
import { createStudioDesign, listStudioDesigns, saveStudioDesign } from './studioCloudApi'
import type { DesignFile } from '@/types/fileSystem'

type Status = 'connecting' | 'ready' | 'saving' | 'error'
type SyncState = { status: Status; error?: string }
const stateListeners = new Set<(s: SyncState) => void>()
let syncState: SyncState = { status: 'connecting' }
function emit(s: SyncState) { syncState = s; stateListeners.forEach(fn => fn(s)) }
export function useCloudSaveStatus() {
 const [status,setStatus]=useState(syncState)
 useEffect(()=>{stateListeners.add(setStatus);return()=>{stateListeners.delete(setStatus)}},[])
 return status
}
function currentFile(): DesignFile | undefined {
 const id=useWorkspaceStore.getState().activeFileId
 return id ? useFileStore.getState().getFile(id) : undefined
}
function syncWorkspaceToFile() {
 const ws=useWorkspaceStore.getState()
 if (!ws.activeFileId || ws.activeFileId==='scratchpad') return
 if (!useFileStore.getState().getFile(ws.activeFileId)) return
 useFileStore.getState().updateFilePages(ws.activeFileId,ws.workspace.pages)
}
/**
 * Embedded Studio sync. Never overwrites local files with cloud contents.
 * Maps local IDs to remote IDs per artist and reconciles using document.id.
 */
export function StudioCloudSync() {
 const session=useStudioSession()
 useEffect(()=>{
  if(!session)return
  let disposed=false,working=false,dirty=false,ready=false
  let timer: ReturnType<typeof setTimeout>|undefined
  const scope=`uo-studio-cloud-map:${session.artistId}`
  let mapping:Record<string,string>={}
  try { mapping=JSON.parse(localStorage.getItem(scope)??'{}') as Record<string,string> } catch { mapping={} }
  const fingerprints=new Map<string,string>()
  const queue=new Set<string>()
  const saveMapping=()=>localStorage.setItem(scope,JSON.stringify(mapping))
  const schedule=(id:string)=>{
   if(!ready||disposed||id==='scratchpad')return
   queue.add(id);dirty=true
   if(timer)clearTimeout(timer)
   timer=setTimeout(()=>{timer=undefined;void flush()},2500)
  }
  const flush=async()=>{
   if(working||disposed||!ready||!dirty)return
   working=true;dirty=false;emit({status:'saving'})
   try{
    while(queue.size&&!disposed){
     const id=queue.values().next().value as string
     queue.delete(id)
     const file=useFileStore.getState().getFile(id)
     if(!file||file.isScratchpad)continue
     const fingerprint=JSON.stringify({name:file.name,pages:file.pages,folderId:file.folderId})
     if(fingerprints.get(id)===fingerprint)continue
     const saved=mapping[id]
      ? await saveStudioDesign(session,mapping[id],file)
      : await createStudioDesign(session,file)
     mapping[id]=saved.id;saveMapping()
     fingerprints.set(id,fingerprint)
     // If an edit occurred during the request, ensure it is uploaded next.
     const latest=useFileStore.getState().getFile(id)
     if(latest&&JSON.stringify({name:latest.name,pages:latest.pages,folderId:latest.folderId})!==fingerprint)queue.add(id)
    }
    if(!disposed)emit({status:'ready'})
   }catch(error){
    dirty=true
    if(!disposed)emit({status:'error',error:error instanceof Error?error.message:'Cloud save failed'})
    // Wait for a subsequent edit or explicit flush; never retry-loop on auth failure.
   }finally{working=false}
  }
  const init=async()=>{
   try{
    const cloud=await listStudioDesigns(session)
    if(disposed)return
    const byLocalId=new Map(cloud.map(d=>[d.document?.id,d]))
    // Import cloud-only files into this browser's library. Preserve the original
    // document ID, so future saves update the same remote design.
    const localIds=new Set(useFileStore.getState().files.map(f=>f.id))
    const imports=cloud.filter(d=>d.document && typeof d.document.id==='string' && Array.isArray(d.document.pages) && !localIds.has(d.document.id))
    if(imports.length){
     useFileStore.setState(s=>({files:[...s.files,...imports.map(d=>({
      ...d.document,
      isScratchpad:false,
      folderId:null,
      updatedAt:d.updated_at,
     }))]}))
     for(const d of imports){mapping[d.document.id]=d.id}
    }
    for(const file of useFileStore.getState().files){
     if(file.isScratchpad)continue
     const matched=byLocalId.get(file.id)
     if(matched){mapping[file.id]=matched.id}
     // Never overwrite an existing cloud document with an older local copy
     // merely because the user opened a different device.
     if(matched&&new Date(matched.updated_at).getTime()>new Date(file.updatedAt).getTime()){
      fingerprints.set(file.id,JSON.stringify({name:file.name,pages:file.pages,folderId:file.folderId}))
     }else queue.add(file.id)
    }
    saveMapping();ready=true;dirty=queue.size>0
    emit({status:'ready'})
    if(dirty)void flush()
   }catch(error){if(!disposed)emit({status:'error',error:error instanceof Error?error.message:'Cloud connection failed'})}
  }
  const unsubFiles=useFileStore.subscribe((next,prev)=>{
   if(!ready||disposed)return
   for(const file of next.files){
    if(file.isScratchpad)continue
    const old=prev.files.find(f=>f.id===file.id)
    if(!old||old!==file)schedule(file.id)
   }
  })
  const unsubWorkspace=useWorkspaceStore.subscribe((next,prev)=>{
   if(!ready||disposed)return
   if(next.workspace!==prev.workspace&&next.activeFileId){
    const id=next.activeFileId
    // Capture workspace changes without subscribing to our own file-store writes.
    if(id!=='scratchpad'&&useRouterStore.getState().route.page!=='library'){
     syncWorkspaceToFile()
    }
   }
  })
  void init()
  return()=>{disposed=true;unsubFiles();unsubWorkspace();if(timer)clearTimeout(timer)}
 },[session])
 return null
}
