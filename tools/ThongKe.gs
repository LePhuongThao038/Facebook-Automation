/* FB Desk · Thống kê bài đã đăng
 * 1. Mở Google Sheet muốn chứa thống kê → Tiện ích mở rộng → Apps Script.
 * 2. Xóa mã mẫu, dán toàn bộ file này, bấm Lưu.
 * 3. Chọn hàm setup → Chạy → cấp quyền. Một hộp thoại hiện "Khóa kết nối": chép lại.
 * 4. Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web
 *      Thực thi với tư cách: Tôi · Người có quyền truy cập: Bất kỳ ai → Triển khai → chép URL ứng dụng web.
 * 5. Dán URL và khóa vào ThongKe-config.json trên máy.
 * Sheet tạo/ghi 3 trang: "Tổng hợp" (ghi đè), "Chi tiết" (ghi đè), "Lịch sử" (thêm dòng mỗi lần gửi).
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw Error('Hãy mở Apps Script từ trong Google Sheet.');
  if (!props.getProperty('statsKey')) props.setProperty('statsKey', Utilities.getUuid() + Utilities.getUuid());
  props.setProperty('statsSheet', book.getId());
  SpreadsheetApp.getUi().alert('Khóa kết nối thống kê FB Desk', props.getProperty('statsKey'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function doPost(e) {
  const reply = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  let lock;
  try {
    const data = JSON.parse(e.postData.contents), props = PropertiesService.getScriptProperties();
    if (!data.key || data.key !== props.getProperty('statsKey')) throw Error('Sai khóa kết nối.');
    const book = SpreadsheetApp.openById(props.getProperty('statsSheet'));
    if (data.ping) return reply({ok: true, sheet: book.getName()});
    const table = t => t && Array.isArray(t.header) && Array.isArray(t.rows) && t.rows.length <= 5000 && t.rows.every(r => Array.isArray(r) && r.length === t.header.length);
    if (!table(data.summary) || !table(data.detail)) throw Error('Dữ liệu thống kê không hợp lệ.');
    lock = LockService.getScriptLock(); lock.waitLock(20000);
    // Chặn chuỗi bị Sheets hiểu thành công thức (caption bắt đầu bằng = + - @).
    const safe = v => (typeof v === 'number') ? v : (/^[=+\-@]/.test(String(v)) ? "'" + v : String(v ?? '').slice(0, 2000));
    const write = (name, t) => {
      const sheet = book.getSheetByName(name) || book.insertSheet(name);
      sheet.clearContents();
      sheet.getRange(1, 1).setValue(name + ' · cập nhật ' + data.at);
      sheet.getRange(3, 1, 1, t.header.length).setValues([t.header]).setFontWeight('bold');
      if (t.rows.length) sheet.getRange(4, 1, t.rows.length, t.header.length).setValues(t.rows.map(r => r.map(safe)));
      sheet.setFrozenRows(3);
    };
    write('Tổng hợp', data.summary);
    write('Chi tiết', data.detail);
    const history = book.getSheetByName('Lịch sử') || book.insertSheet('Lịch sử');
    if (!history.getLastRow()) history.appendRow(['Thời điểm'].concat(data.summary.header.slice(0, 11)));
    const at = data.at;
    data.summary.rows.forEach(r => history.appendRow([at].concat(r.slice(0, 11).map(safe))));
    SpreadsheetApp.flush();
    return reply({ok: true, sheet: book.getName(), nicks: data.summary.rows.length, posts: data.detail.rows.length});
  } catch (err) {
    return reply({ok: false, error: err.message});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
