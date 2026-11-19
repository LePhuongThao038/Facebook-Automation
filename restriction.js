(()=>{
 const pattern=/temporarily blocked|going too fast|we limit how often|we restrict certain activity|we suspect automated behavior|we suspect automated behaviou?r|tạm thời bị chặn|bị chặn tạm thời|thao tác quá nhanh|chúng tôi giới hạn tần suất|chúng tôi nghi ngờ.*tự động|xác minh danh tính của bạn|confirm your identity/i;
 let sent='',timer;
 function warning(){
  if(/^\/(checkpoint|two_step_verification)(\/|$)/.test(location.pathname))return 'Facebook yêu cầu xác minh tài khoản ('+location.pathname.split('/')[1]+')';
  const surfaces=document.querySelectorAll('[role=alert],[role=alertdialog],[role=dialog],[role=status],main h1,[role=main] h1');
  for(const node of surfaces){
   if(!node.getClientRects().length||node.closest('article,[role=article]'))continue;
   const lines=(node.innerText||'').split('\n');
   const line=lines.find(s=>pattern.test(s));if(line)return line.trim().slice(0,450);
  }
  return '';
 }
 function inspect(){
  timer=null;const reason=warning();
  if(reason&&reason!==sent){sent=reason;chrome.runtime.sendMessage({type:'desk-restriction',reason}).catch(()=>{sent='';});}
  return reason;
 }
 globalThis.deskRestriction=inspect;
 new MutationObserver(()=>{if(!timer)timer=setTimeout(inspect,200);}).observe(document,{subtree:true,childList:true,characterData:true});
 inspect();
})();
