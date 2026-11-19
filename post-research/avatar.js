// Injected into a Facebook tab. Match the CDN photo identity across cropped and full-size variants.
function findAvatarSource(stage, thumbnail) {
  function photoKey(url) {
    try { return new URL(url).pathname.split('/').pop().match(/^\d+_(\d+)_(\d+)/)?.slice(1).join('_'); }
    catch { return null; }
  }
  const key = photoKey(thumbnail);
  if (stage === 'albums') {
    return [...document.querySelectorAll('a[href*="/media/set"]')].find(a =>
      /^(profile pictures|profile photos|ảnh đại diện)(?:\s|$)/i.test((a.getAttribute('aria-label') || a.innerText).trim()))?.href;
  }
  if (stage === 'recent') {
    const albumId = new URL(location.href).searchParams.get('set');
    if (!albumId) return;
    const candidates = new Map();
    for (const img of document.querySelectorAll('a[href*="fbid="] img')) {
      const page = new URL(img.closest('a').href);
      if (page.searchParams.get('set') !== albumId || !photoKey(img.src)) continue;
      candidates.set(page.href,{page:page.href,thumbnail:img.src});
    }
    return candidates.size ? [...candidates.values()] : undefined;
  }
  if (stage === 'album') {
    if (!key) return;
    const photos = [...document.querySelectorAll('a[href*="fbid="] img')];
    const match = photos.find(im => photoKey(im.currentSrc || im.src) === key);
    if (match) return match.closest('a').href;
    // Facebook adds later album rows only when the last visible row is reached.
    photos.at(-1)?.scrollIntoView({block:'end'});
    return;
  }
  const candidates = [...document.images].filter(im => im.complete && im.naturalWidth &&
    !im.closest('[role=article],article') && im.getBoundingClientRect().width > 0 &&
    (key ? photoKey(im.currentSrc || im.src) === key : im.matches('[data-visualcompletion="media-vc-image"]')));
  candidates.sort((a,b) => b.naturalWidth*b.naturalHeight-a.naturalWidth*a.naturalHeight);
  return candidates[0]?.currentSrc;
}

async function avatarPicture(src) {
  const blob = await media(src);
  const bitmap = await createImageBitmap(blob);
  try {
    const w = bitmap.width, h = bitmap.height;
    const head = new Uint8Array(await blob.slice(0,3).arrayBuffer());
    if (head[0] === 255 && head[1] === 216 && head[2] === 255)
      return {w,h,data:new Uint8Array(await blob.arrayBuffer())};
    const canvas = new OffscreenCanvas(w,h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,w,h); ctx.drawImage(bitmap,0,0);
    const jpeg = await canvas.convertToBlob({type:'image/jpeg',quality:1});
    return {w,h,data:new Uint8Array(await jpeg.arrayBuffer())};
  } finally { bitmap.close(); }
}

async function resolveAvatar(profile) {
  const label = 'Ảnh Avatar', thumb = profile.media[label][0];
  let tab;
  async function findAt(url,stage,reference=thumb) {
    if (!tab) tab = await chrome.tabs.create({url,active:false});
    else await chrome.tabs.update(tab.id,{url,active:false});
    const attempts = stage === 'album' ? 35 : 15;
    for (let attempt=0;attempt<attempts;attempt++) {
      await sleep(400);
      const current = await chrome.tabs.get(tab.id);
      if (current.status !== 'complete' || current.url === 'about:blank') continue;
      const [entry] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:findAvatarSource,args:[stage,reference]});
      if (entry?.result) return entry.result;
    }
  }
  try {
    let current = await avatarPicture(thumb);
    let currentSrc = thumb;
    async function readPhoto(page, reference) {
      if (!page) return null;
      try {
        const src = await findAt(page,'photo',reference);
        if (src) return {...await avatarPicture(src),src};
      } catch { /* Continue with other visible album entries. */ }
      return null;
    }
    function keep(image) {
      profile.media[label] = [image.src];
      profile.pics[label] = [image];
    }
    const adequate = image => image && Math.min(image.w,image.h) >= 720;
    function consider(image) {
      if (image && image.w*image.h > current.w*current.h) {
        current = image;
        currentSrc = image.src;
      }
    }
    consider(await readPhoto(profile.avatarPage,thumb));
    if (adequate(current)) { keep({...current,src:currentSrc}); return; }
    const albums = new URL(profile.url);
    if (albums.pathname === '/profile.php') albums.searchParams.set('sk','photos_albums');
    else albums.pathname = albums.pathname.replace(/\/$/,'') + '/photos_albums';
    const album = await findAt(albums.href,'albums');
    if (album) {
      const recent = await findAt(album,'recent') || [];
      const exact = await findAt(album,'album');
      if (exact && exact !== profile.avatarPage) consider(await readPhoto(exact,thumb));
      if (adequate(current)) { keep({...current,src:currentSrc}); return; }
      for (const candidate of recent) {
        if (candidate.page === exact || candidate.page === profile.avatarPage) continue;
        const image = await readPhoto(candidate.page,candidate.thumbnail);
        if (!adequate(image)) continue;
        keep(image);
        profile.avatarWarning = 'Ảnh thay thế từ album Ảnh đại diện (' + image.w + ' × ' + image.h + ' px).';
        profile.avatarSource = candidate.page;
        return;
      }
    }
    const preview = current;
    keep({...preview,src:currentSrc});

    profile.avatarWarning = 'Facebook chỉ hiển thị ảnh xem trước (' + preview.w + ' × ' + preview.h + ' px).';
  } finally { if (tab) await chrome.tabs.remove(tab.id).catch(()=>{}); }
}
