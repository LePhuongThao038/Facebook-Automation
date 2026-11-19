const selector=document.getElementById('theme-select');
const themes=['aurora','sakura','midnight'];
chrome.storage.local.get('deskTheme').then(({deskTheme})=>{const theme=themes.includes(deskTheme)?deskTheme:'aurora';document.documentElement.dataset.theme=theme;selector.value=theme;});
selector.addEventListener('change',()=>{const theme=selector.value;if(!themes.includes(theme))return;document.documentElement.dataset.theme=theme;chrome.storage.local.set({deskTheme:theme});});
