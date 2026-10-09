import type { DesignFile } from '@/types/fileSystem'
const ENDPOINT='https://pqinsgsatlsofpstdaie.supabase.co/functions/v1/creator-studio-cloud'
export type StudioCloudSession={sessionToken:string;artistId:string;userId:string}
export type StudioCloudDesign={id:string;artist_id:string;created_by:string;title:string;document:DesignFile;updated_at:string}
export type StudioCloudVersion={id:string;version_number:number;title:string;document:DesignFile;created_by:string|null;created_at:string;label:string|null;protected:boolean;reason:string}
async function request<T>(session:StudioCloudSession,body:Record<string,unknown>):Promise<T>{
 if(!/^[0-9a-f]{64}$/.test(session.sessionToken))throw new Error('Studio cloud session required')
 const response=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${session.sessionToken}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'})
 const payload=await response.json() as {data?:T;error?:string}
 if(!response.ok||payload.error)throw new Error(payload.error??'Studio cloud request failed')
 return payload.data as T
}
export const listStudioDesigns=(session:StudioCloudSession)=>request<StudioCloudDesign[]>(session,{action:'list'})
export const createStudioDesign=(session:StudioCloudSession,file:DesignFile)=>request<StudioCloudDesign>(session,{action:'create',file})
export const saveStudioDesign=(session:StudioCloudSession,designId:string,file:DesignFile)=>request<StudioCloudDesign>(session,{action:'save',designId,file})
export const listStudioVersions=(session:StudioCloudSession,designId:string)=>request<StudioCloudVersion[]>(session,{action:'versions',designId})
