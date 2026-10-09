import type { DesignFile } from '@/types/fileSystem'
import { nanoid } from 'nanoid'

export const isStudioConflict=(error:unknown):boolean=>
 error instanceof Error && /Design changed in another browser/.test(error.message)

/** A distinct, locally recoverable design; never mutates the original. */
export function makeConflictRecovery(file:DesignFile,now=new Date().toISOString()):DesignFile {
 return {...structuredClone(file),id:nanoid(),name:file.name+' (conflict recovery)',isScratchpad:false,folderId:null,createdAt:now,updatedAt:now}
}

/** Exercise conflict handling without network calls or touching artist designs. */
export async function simulateConflictRecovery():Promise<{passed:boolean;details:string}> {
 const original={id:'simulation-original',name:'Conflict test',isScratchpad:false,folderId:null,createdAt:'2026-01-01',updatedAt:'2026-01-01',pages:[{id:'page-test',frames:[]}]} as unknown as DesignFile
 const originalBefore=JSON.stringify(original)
 const conflict=new Error('Design changed in another browser. Reopen to review before saving.')
 if(!isStudioConflict(conflict))throw new Error('Conflict not recognized')
 const recovery=makeConflictRecovery(original)
 if(recovery.id===original.id||recovery.name===original.name)throw new Error('Recovery must be separate')
 if(JSON.stringify(original)!==originalBefore)throw new Error('Original mutated')
 if(JSON.stringify(recovery.pages)!==JSON.stringify(original.pages))throw new Error('Recovery lost document pages')
 if(isStudioConflict(new Error('Authentication required')))throw new Error('Unrelated failure misclassified')
 return {passed:true,details:'Conflict detected; distinct recovery copy retains document; original unchanged; unrelated errors ignored.'}
}
