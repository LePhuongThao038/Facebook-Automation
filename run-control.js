export const RUN_KEY='deskRunControl';
export const ACTION_GAP=60000;
export async function allowed(){
 return (await chrome.storage.local.get(RUN_KEY))[RUN_KEY]?.enabled===true;
}
export async function taskSlot(work){
 return navigator.locks.request('facebook-desk-task',{ifAvailable:true},async lock=>{
  if(lock&&await allowed())return work();
 });
}
export async function actionSlot(){
 return navigator.locks.request('facebook-desk-action',async()=>{
  if(!await allowed())throw Error('Tự động hóa đang tạm dừng.');
  const last=(await chrome.storage.local.get('deskLastInteraction')).deskLastInteraction||0;
  const waitMs=Math.max(0,last+ACTION_GAP-Date.now());
  if(waitMs)return {waitMs};
  await chrome.storage.local.set({deskLastInteraction:Date.now()});
  return true;
 });
}
