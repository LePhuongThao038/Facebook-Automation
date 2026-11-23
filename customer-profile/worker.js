// Bấm biểu tượng extension: mở (hoặc chuyển tới) trang Hồ sơ khách hàng.
chrome.action.onClicked.addListener(async()=>{
 const url=chrome.runtime.getURL('customer.html');
 const [tab]=await chrome.tabs.query({url});
 if(tab){await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});}
 else await chrome.tabs.create({url});
});
