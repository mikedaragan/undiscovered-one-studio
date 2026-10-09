import type { DesignFile } from '@/types/fileSystem'
import type { DesignConflict,ConflictChoice } from './resolveDesignConflict'
type Props={conflict:DesignConflict;busy:boolean;error:string;onChoose:(choice:ConflictChoice)=>void}
const countLayers=(file:DesignFile)=>file.pages.reduce((n,p)=>n+p.frames.reduce((m,f)=>m+f.layers.length,0),0)
export function ConflictDialog({conflict,busy,error,onChoose}:Props){
 const versions=[{name:'This device',file:conflict.local,date:conflict.local.updatedAt},{name:'Cloud',file:conflict.remote.document,date:conflict.remote.updated_at}]
 return <div className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Resolve design conflict">
 <div className="bg-card text-foreground rounded-xl p-4 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
 <h2 className="font-semibold text-lg mb-2">Two versions of your design</h2>
 <p className="text-sm mb-3">Another browser saved a different version. Compare the details below and choose which to keep. Nothing will be deleted automatically.</p>
 <div className="grid grid-cols-2 gap-2 mb-4">{versions.map(v=><div key={v.name} className="border rounded p-3 min-w-0">
 <strong className="text-sm">{v.name}</strong><p className="text-sm truncate">{v.file.name}</p>
 <p className="text-xs text-muted-foreground">{v.file.pages.length} pages · {countLayers(v.file)} layers</p>
 <p className="text-xs">{new Date(v.date).toLocaleString()}</p>
 </div>)}</div>
 {error&&<p role="alert" className="text-destructive text-sm mb-3">{error}</p>}
 <div className="flex flex-wrap gap-2">
 <button disabled={busy} className="rounded bg-primary text-primary-foreground px-3 py-2 text-sm" onClick={()=>onChoose('both')}>Keep both (recommended)</button>
 <button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={()=>{if(window.confirm('Replace the cloud design with this device? A protected cloud checkpoint will be created first.'))onChoose('local')}}>Use this device</button>
 <button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={()=>{if(window.confirm('Replace this device with the cloud version? A separate cloud backup of this device will be created first.'))onChoose('cloud')}}>Use cloud version</button>
 </div>
 <p className="text-xs text-muted-foreground mt-3">Keep Both creates a separate cloud design. Choosing either overwrite option preserves a backup.</p>
 </div></div>
}
