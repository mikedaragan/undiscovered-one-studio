import { useEffect, useState } from 'react'
import { useStudioSession } from '@/components/auth/StudioAuthGate'
import { getStudioCloudDesignId, useCloudSaveStatus } from '@/cloud/StudioCloudSync'
import { checkpointStudioDesign, listStudioVersions, restoreStudioDesign, type StudioCloudVersion } from '@/cloud/studioCloudApi'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useFileStore } from '@/store/useFileStore'
import { useRouterStore } from '@/store/useRouterStore'
import { History, X } from 'lucide-react'

export function CloudHistory() {
 const session=useStudioSession()
 const fileId=useWorkspaceStore(s=>s.activeFileId)
 const cloud=useCloudSaveStatus()
 const [open,setOpen]=useState(false)
 const [versions,setVersions]=useState<StudioCloudVersion[]>([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [label,setLabel]=useState('')
 const designId=session&&fileId?getStudioCloudDesignId(session.artistId,fileId):undefined
 const load=async()=>{if(!session||!designId)return;setBusy(true);setError('');try{setVersions(await listStudioVersions(session,designId))}catch(e){setError(String(e))}finally{setBusy(false)}}
 useEffect(()=>{if(open)void load()},[open,designId])
 const checkpoint=async()=>{
  if(!session||!designId)return
  setBusy(true);setError('')
  try{await checkpointStudioDesign(session,designId,label.trim()||'Checkpoint');setLabel('');await load()}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 const restore=async(v:StudioCloudVersion)=>{
  if(!session||!designId||!fileId)return
  if(!window.confirm('Restore this cloud version? Your current cloud design will be backed up first.'))return
  setBusy(true);setError('')
  try{
   const result=await restoreStudioDesign(session,designId,v.version_number)
   // Keep the restored cloud document in the local library, then reopen the editor.
   useFileStore.setState(s=>({files:s.files.map(f=>f.id===fileId?{...result.document,id:fileId,isScratchpad:false,updatedAt:result.updated_at}:f)}))
   useWorkspaceStore.setState({activeFileId:null,activeFrameId:null})
   useRouterStore.getState().navigate({page:'library'})
   setOpen(false)
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 if(!session||!fileId||fileId==='scratchpad')return null
 return <>
  <button type="button" onClick={()=>setOpen(true)} className="rounded-md border border-border bg-card px-2 py-1 text-xs flex items-center gap-1" title="Cloud version history"><History className="h-4 w-4"/> <span className="hidden sm:inline">History</span></button>
  {open&&<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Cloud version history">
   <div className="bg-card text-foreground rounded-xl p-4 w-full max-w-md max-h-[80vh] overflow-auto shadow-xl">
    <div className="flex justify-between items-center mb-3"><strong>Cloud version history</strong><button onClick={()=>setOpen(false)} aria-label="Close"><X className="h-5 w-5"/></button></div>
    {!designId?<p className="text-sm">Waiting for this design's first cloud save. Try reopening after saving.</p>:<>
     <div className="flex gap-2 mb-3"><input className="min-w-0 flex-1 border rounded px-2 py-1 bg-background text-sm" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Checkpoint name"/><button className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm" disabled={busy||cloud.status==='saving'} onClick={()=>void checkpoint()}>Save checkpoint</button></div>
     <button className="text-xs underline mb-2" onClick={()=>void load()} disabled={busy}>Refresh history</button>
     {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
     {versions.length===0?<p className="text-sm text-muted-foreground">No cloud snapshots yet.</p>:versions.map(v=><div key={v.id} className="flex gap-3 items-center justify-between border-t py-2"><div className="min-w-0"><div className="font-medium text-sm truncate">{v.label||'Version '+v.version_number}</div><div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()} · {v.reason}</div></div><button disabled={busy||cloud.status==='saving'} onClick={()=>void restore(v)} className="shrink-0 text-sm underline">Restore</button></div>)}
    </>}
   </div>
  </div>}
 </>
}
