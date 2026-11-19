/* Dán vào Tiện ích mở rộng → Apps Script của file log rồi chạy setup một lần. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) throw Error('Hãy mở Apps Script từ trong Google Sheet.');
  if (!props.getProperty('friendKey')) props.setProperty('friendKey', Utilities.getUuid()+Utilities.getUuid());
  props.setProperty('friendSheet',sheet.getId());
  SpreadsheetApp.getUi().alert('Khóa kết nối Facebook Desk',props.getProperty('friendKey'),SpreadsheetApp.getUi().ButtonSet.OK);
}
function doPost(e) {
  const reply = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  let lock;
  try {
    const data=JSON.parse(e.postData.contents), props=PropertiesService.getScriptProperties();
    if(!data.key || data.key!==props.getProperty('friendKey') || data.sheet!==props.getProperty('friendSheet')) throw Error('Sai khóa hoặc file Google Sheet.');
    const book=SpreadsheetApp.openById(data.sheet);
    if(data.ping)return reply({ok:true});
    const actor=data.actor;
    if(!actor||!/^https:\/\/www\.facebook\.com\//.test(actor.url)||!actor.name||!Array.isArray(data.rows)||data.rows.length>40)throw Error('Dữ liệu log không hợp lệ.');
    lock=LockService.getScriptLock();lock.waitLock(20000);
    const all=props.getProperties(),prop='nick:'+actor.url;
    let sheet=book.getSheets().find(s=>String(s.getSheetId())===all[prop]);
    const title=String(actor.name).replace(/[\\\/?*\[\]:]/g,' ').slice(0,70).trim()||'Facebook';
    if(!sheet){
      sheet=book.getSheetByName(title);
      if(sheet && (Object.keys(all).some(k=>k.indexOf('nick:')===0&&k!==prop&&all[k]===String(sheet.getSheetId())) || (sheet.getLastRow() && String(sheet.getRange(3,2).getValue()).toLowerCase()!=='uid')))sheet=null;
      if(!sheet){let label=title, n=2;while(book.getSheetByName(label))label=title+' ('+(n++)+')';sheet=book.insertSheet(label);}
      props.setProperty(prop,String(sheet.getSheetId()));
    }
    const base=['Date','Uid','Tên','Nhận xét chất lượng bạn của AI','Tình trạng'];
    if(!sheet.getLastRow()){sheet.getRange(1,1).setValue('Danh sách bạn');sheet.getRange(3,1,1,5).setValues([base]);}
    const headers=sheet.getRange(3,1,1,Math.max(5,sheet.getLastColumn())).getDisplayValues()[0];
    const col=key=>{let i=headers.findIndex(h=>h.toLowerCase()===key.toLowerCase());if(i<0){i=headers.length;headers.push(key);sheet.getRange(3,i+1).setValue(key);}return i+1;};
    const cols=['Date','Uid','Tên','Warm up','Kết bạn','Tình trạng','Chi tiết'].map(col);
    const last=sheet.getLastRow(),ids=last>3?sheet.getRange(4,cols[1],last-3,1).getDisplayValues().map(r=>String(r[0]).trim()):[];
    const rows=new Map(ids.map((id,i)=>[id,i+4]));let next=Math.max(4,last+1);
    for(const x of data.rows){
      if(!/^[a-zA-Z0-9.]{1,100}$/.test(x.id))throw Error('UID/profile không hợp lệ.');
      let row=rows.get(x.id);if(!row){row=next++;rows.set(x.id,row);}
      const values=[x.date,x.id,x.name,x.warm,x.send,x.relation,x.detail];
      cols.forEach((column,i)=>{if(i===2&&!values[i])return;const cell=sheet.getRange(row,column);let v=String(values[i]||'').slice(0,1500);cell.setNumberFormat('@').setValue(/^[=+@-]/.test(v)?"'"+v:v);});
    }
    SpreadsheetApp.flush();return reply({ok:true});
  } catch(err){return reply({ok:false,error:err.message});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
