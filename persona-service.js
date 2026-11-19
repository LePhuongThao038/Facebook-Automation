import {assertFixedRoster} from './cross-role-lock.js';
import {PERSONA_KEY,BINDING_KEY,emptyRegistry,validateRegistry,applyPersonaEdit,planPersonaImport,bindPersona,resolvePersona,personaContext} from './persona-model.js';
export function personaService({lock,detectAccount}){
 const read=async()=>{const v=await chrome.storage.local.get([PERSONA_KEY,BINDING_KEY]);const registry=v[PERSONA_KEY]?validateRegistry(v[PERSONA_KEY]):emptyRegistry();if(!v[PERSONA_KEY])await chrome.storage.local.set({[PERSONA_KEY]:registry});return {registry,binding:v[BINDING_KEY]||null};};
 return async function handle(msg){
  let actor,accountError='';
  if(['persona-current','persona-bind'].includes(msg.type)){try{actor=await detectAccount(true);}catch(e){accountError=e.message;}}
  return lock(async()=>{
   const state=await read(),r=state.registry;
   if(msg.type==='persona-state')return state;
   if(msg.type==='persona-current'){if(accountError)return {matched:false,ready:false,reason:accountError};return resolvePersona(r,state.binding,actor);}
   if(msg.type==='persona-bind'){if(accountError)throw Error(accountError);const binding=bindPersona(r,msg.profileId,actor);await chrome.storage.local.set({[BINDING_KEY]:binding});return resolvePersona(r,binding,actor);}
   if(msg.type==='persona-context')return personaContext(r,msg.from,msg.to,msg.topic);
   if(msg.type==='persona-import-preview'){const p=planPersonaImport(r,msg.registry);return {added:p.added,updated:p.updated,relations:p.relations,revision:r.revision};}
   if(!['persona-save','persona-import'].includes(msg.type))throw Error('Yêu cầu nhân vật không hợp lệ.');
   if(msg.revision!==r.revision)throw Error('Danh bạ đã thay đổi ở cửa sổ khác. Tải lại danh bạ trước khi lưu.');
   const next=msg.type==='persona-save'?applyPersonaEdit(r,msg.edit):planPersonaImport(r,msg.registry).registry;
   const maps=(await chrome.storage.local.get('deskCrossMappings')).deskCrossMappings||{};assertFixedRoster(r,next,maps);await chrome.storage.local.set({[PERSONA_KEY]:next});return {registry:next,binding:state.binding};
  });
 };
}
