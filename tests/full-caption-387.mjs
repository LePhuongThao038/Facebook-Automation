// 3.8.7-cap: lấy lại caption đầy đủ cho bài "rút gọn". Trang ảnh Facebook mô phỏng, không kết nối Facebook thật.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {truncatedPrefix, acceptRecovered, isVideoSource, readFullCaption, flatCaption} from '../full-caption.js';
import {captionIssue} from '../automation-model.js';

// Hàm thuần
assert.equal(truncatedPrefix('NƯỚC ĐỨC CHIA TAY NHÀ LÃNH ĐẠO CỦA MÌNH.…'), 'NƯỚC ĐỨC CHIA TAY NHÀ LÃNH ĐẠO CỦA MÌNH.');
assert.equal(truncatedPrefix('39 TUỔI THẤT NGHIỆP MỚI NGẤM ĐÒN: …'), '39 TUỔI THẤT NGHIỆP MỚI NGẤM ĐÒN:');
assert.equal(truncatedPrefix('Hành trình 1 năm 🚀... Xem thêm'), 'Hành trình 1 năm 🚀');
assert.ok(acceptRecovered('Hành trình bán Shopify 🚀', 'Hành trình bán Shopify của mình trong 1 năm qua 🚀 rất dài'));
assert.ok(!acceptRecovered('Hành trình bán Shopify', 'Một bài khác hoàn toàn và dài hơn nhiều'), 'không nhận caption khác đầu');
assert.ok(!acceptRecovered('Hành trình bán Shopify', 'Hành trình bán Shopify'), 'không nhận bản không dài hơn');
assert.ok(isVideoSource('https://www.facebook.com/reel/968736839266129/') && !isVideoSource('https://www.facebook.com/photo/?fbid=1'));
assert.equal(captionIssue({text: 'Có caption…', captionPartial: true, media: [{type: 'image'}]}), '', 'caption rút gọn không còn bị chặn');
assert.match(captionIssue({text: 'Duy ơi cảm ơn', captionPartial: true, captionEvidence: 'text-block;nghi-tra-loi-binh-luan', media: [{type: 'image'}]}), /trả lời bình luận/, 'nghi trả lời bình luận vẫn bị chặn');

const require = createRequire(process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = require('playwright');
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const FULL = 'Hi ae! Nhiều ae nhắn hỏi mình cách làm, nên hôm nay mình chia sẻ hành trình bán Shopify của mình trong 1 năm qua 🚀\nTháng 1: bắt đầu từ con số 0.\nTháng 12: đạt 1 tỷ doanh thu 🎉';
const SHORT = 'Hi ae! Nhiều ae nhắn hỏi mình cách làm, nên hôm nay mình chia sẻ hành trình bán Shopify của mình trong 1 năm qua 🚀…';
const run = (page, request) => page.evaluate(({fn, request}) => (0, eval)('(' + fn + ')')(request), {fn: readFullCaption.toString(), request});
const results = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', r => r.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'}));
  await page.goto('https://www.facebook.com/photo/?fbid=39603423869305318');
  await page.evaluate(({FULL}) => {
    // Emoji Facebook vẽ bằng <img alt>; caption cắt ngắn tới khi bấm "Xem thêm".
    const html = t => t.replace(/🚀|🎉/g, m => `<img alt="${m}" src="data:,">`).replace(/\n/g, '<br>');
    document.body.innerHTML = `<div role="main"><img src="data:," width="600" height="400"></div>
      <div role="complementary"><h2><a href="/profile.php?id=1">Chủ bài</a></h2>
        <div><div dir="auto" id="cap"></div></div>
        <ul><li><div dir="auto">Duy Nguyễn tks bro. Quá hữu ích</div></li>
            <li><div dir="auto">Hi ae! Nhiều ae nhắn hỏi mình cách làm, nên hôm nay mình chia sẻ hành trình bán Shopify — mình cũng muốn học</div></li></ul>
        <div role="textbox" contenteditable="true"></div></div>`;
    const cap = document.getElementById('cap');
    cap.innerHTML = html(FULL.slice(0, 110)) + '… <div role="button">Xem thêm</div>';
    cap.querySelector('[role=button]').onclick = () => { setTimeout(() => { cap.innerHTML = html(FULL) + ' <div role="button">Ẩn bớt</div>'; }, 50); };
  }, {FULL});
  const prefix = truncatedPrefix(SHORT);
  let got = await run(page, {prefix, expand: true});
  assert.equal(got.expanding, true, 'lượt đầu bấm Xem thêm');
  await page.waitForTimeout(150);
  got = await run(page, {prefix, expand: true});
  assert.equal(got.found, true, JSON.stringify(got));
  assert.ok(acceptRecovered(prefix, got.text), 'caption lấy về bắt đầu đúng đoạn đã có');
  assert.equal(flatCaption(got.text), flatCaption(FULL), 'đủ caption, kể cả emoji và các dòng sau');
  assert.ok(!/Ẩn bớt|Duy Nguyễn|mình cũng muốn học/.test(got.text), 'không lẫn nút hoặc bình luận');
  results.push('trang ảnh: bấm Xem thêm, lấy đủ ' + got.text.length + ' ký tự, đúng emoji và xuống dòng, không lẫn bình luận');

  // Không có caption khớp: không đoán bừa.
  const miss = await run(page, {prefix: 'Một caption không có trên trang này', expand: false});
  assert.equal(miss.found, false);
  results.push('caption không có trên trang: không nhận bừa');
  console.log('PASS full-caption-387');
  for (const r of results) console.log(' ✓', r);
} finally { await browser.close(); }
