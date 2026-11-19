// 3.8.7: đồng hồ xoay thay cho danh sách "3 phút / 5 phút / 10 phút…".
// Một mặt đồng hồ, hai chế độ dùng chung một vòng xoay:
//  - "Bắt đầu": kim chạy như đồng hồ thật. Một vòng = 60 phút, quay qua 12 giờ thì kim giờ tự sang giờ kế.
//    Không cho quay lùi về quá khứ ("Ngay bây giờ").
//  - "Khoảng cách": một vòng = 60 phút, quay tiếp để lên giờ (1 phút … 24 giờ). Không còn mốc cố định.
// Điều khiển: kéo quanh mặt đồng hồ, cuộn chuột (Shift = 10 phút), phím mũi tên / PageUp / PageDown.
const MIN_GAP=1,MAX_GAP=24*60,MAX_AHEAD=14*24*60;
const pad=n=>String(n).padStart(2,'0');
const clock=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes());};
const dayLabel=t=>{const d=new Date(t),today=new Date();const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()),b=new Date(today.getFullYear(),today.getMonth(),today.getDate());const diff=Math.round((a-b)/86400000);return diff===0?'hôm nay':diff===1?'ngày mai':pad(d.getDate())+'/'+pad(d.getMonth()+1);};
export function formatGap(minutes){const h=Math.floor(minutes/60),m=minutes%60;return h?(h+' giờ'+(m?' '+m+' phút':'')):m+' phút';}

// Thời điểm đăng dự kiến của n bài, dùng chung cho xem trước và kiểm thử.
export function previewTimes({startAt,minutes},count,now=Date.now()){
 const start=Math.max(now,startAt||now);return Array.from({length:Math.max(0,count)},(_,i)=>start+i*minutes*60000);
}

export function createScheduleDial(root,{minutes=3,onChange=()=>{},now=()=>Date.now()}={}){
 const state={mode:'gap',gap:Math.min(MAX_GAP,Math.max(MIN_GAP,Math.round(minutes))),offset:0,count:0};
 // offset = số phút tính từ "bây giờ" (làm tròn lên phút) tới giờ bắt đầu; 0 = ngay bây giờ.
 const base=()=>{const t=now();return Math.ceil(t/60000)*60000;};
 const startAt=()=>state.offset?base()+state.offset*60000:0;
 const ns='http://www.w3.org/2000/svg',el=(tag,attrs={},parent)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(parent)parent.append(e);return e;};
 root.classList.add('dial');root.replaceChildren();
 const tabs=document.createElement('div');tabs.className='dial-modes';tabs.setAttribute('role','radiogroup');tabs.setAttribute('aria-label','Chỉnh');
 const tab=(mode,text)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.mode=mode;b.setAttribute('role','radio');b.addEventListener('click',()=>{state.mode=mode;render();face.focus();});tabs.append(b);return b;};
 tab('start','Giờ bắt đầu');tab('gap','Khoảng cách');
 const face=el('svg',{viewBox:'0 0 200 200',class:'dial-face',tabindex:'0',role:'slider'});
 el('circle',{cx:100,cy:100,r:92,class:'dial-rim'},face);
 for(let i=0;i<60;i++){const a=i*6*Math.PI/180,r1=i%5?84:78;el('line',{x1:100+r1*Math.sin(a),y1:100-r1*Math.cos(a),x2:100+88*Math.sin(a),y2:100-88*Math.cos(a),class:i%5?'dial-tick':'dial-tick major'},face);}
 for(let h=1;h<=12;h++){const a=h*30*Math.PI/180;const t=el('text',{x:100+68*Math.sin(a),y:100-68*Math.cos(a)+4,class:'dial-num'},face);t.textContent=h;}
 const arc=el('path',{class:'dial-arc'},face);
 const hourHand=el('line',{x1:100,y1:100,class:'dial-hand hour'},face);
 const minuteHand=el('line',{x1:100,y1:100,class:'dial-hand minute'},face);
 const knob=el('circle',{r:7,class:'dial-knob'},face);el('circle',{cx:100,cy:100,r:4,class:'dial-pin'},face);
 const readout=document.createElement('div');readout.className='dial-readout';
 const big=document.createElement('strong'),small=document.createElement('small');readout.append(big,small);
 const preview=document.createElement('p');preview.className='dial-preview';preview.setAttribute('role','status');preview.setAttribute('aria-live','polite');
 const reset=document.createElement('button');reset.type='button';reset.className='dial-reset';reset.textContent='Về "ngay bây giờ"';reset.addEventListener('click',()=>{state.offset=0;render();});
 const wrap=document.createElement('div');wrap.className='dial-wrap';wrap.append(face,readout);
 root.append(tabs,wrap,reset,preview);

 const point=(deg,r)=>{const a=deg*Math.PI/180;return [100+r*Math.sin(a),100-r*Math.cos(a)];};
 const roll=delta=>{
  if(!delta)return;
  if(state.mode==='gap')state.gap=Math.min(MAX_GAP,Math.max(MIN_GAP,state.gap+delta));
  else state.offset=Math.min(MAX_AHEAD,Math.max(0,state.offset+delta));
  render();
 };
 function render(){
  for(const b of tabs.children){const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-checked',String(on));}
  let minuteDeg,hourDeg,label,note;
  if(state.mode==='gap'){
   minuteDeg=(state.gap%60)*6;hourDeg=Math.floor(state.gap/60)%12*30;
   label=formatGap(state.gap);note=state.gap>=60?'mỗi vòng = 60 phút':'quay tiếp để lên giờ';
   face.setAttribute('aria-label','Khoảng cách giữa hai bài');face.setAttribute('aria-valuemin',MIN_GAP);face.setAttribute('aria-valuemax',MAX_GAP);face.setAttribute('aria-valuenow',state.gap);face.setAttribute('aria-valuetext',label);
   const end=point(minuteDeg||(state.gap>=60?359.9:0),92),large=minuteDeg>180?1:0;
   arc.setAttribute('d',state.gap>=60&&!minuteDeg?'M100 8 A92 92 0 1 1 99.99 8':'M100 8 A92 92 0 '+large+' 1 '+end[0]+' '+end[1]);
  }else{
   const t=startAt()||base(),d=new Date(t);
   minuteDeg=d.getMinutes()*6;hourDeg=(d.getHours()%12)*30+d.getMinutes()/2;
   label=state.offset?clock(t):'Ngay bây giờ';note=state.offset?dayLabel(t)+' · sau '+formatGap(state.offset):'kéo kim để hẹn giờ';
   face.setAttribute('aria-label','Giờ đăng bài đầu tiên');face.setAttribute('aria-valuemin',0);face.setAttribute('aria-valuemax',MAX_AHEAD);face.setAttribute('aria-valuenow',state.offset);face.setAttribute('aria-valuetext',state.offset?dayLabel(t)+' '+clock(t):'Ngay bây giờ');
   arc.setAttribute('d','');
  }
  const m=point(minuteDeg,74),h=point(hourDeg,48),k=point(minuteDeg,92);
  minuteHand.setAttribute('x2',m[0]);minuteHand.setAttribute('y2',m[1]);hourHand.setAttribute('x2',h[0]);hourHand.setAttribute('y2',h[1]);knob.setAttribute('cx',k[0]);knob.setAttribute('cy',k[1]);
  big.textContent=label;small.textContent=note;reset.hidden=state.mode!=='start'||!state.offset;
  const times=previewTimes(value(),Math.min(state.count||3,4),now());
  preview.textContent=(state.count?state.count+' bài · ':'')+'Bắt đầu '+(state.offset?dayLabel(times[0])+' '+clock(times[0]):'ngay')+', mỗi bài cách '+formatGap(state.gap)+' → '+times.map(clock).join(' · ')+(state.count>4?' …':'');
  onChange(value());
 }
 // Kéo: cộng dồn góc quay, mỗi 6° = 1 phút, quay nhiều vòng được.
 let dragging=null;
 const angleAt=e=>{const r=face.getBoundingClientRect();return Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)))*180/Math.PI;};
 face.addEventListener('pointerdown',e=>{dragging={last:angleAt(e),carry:0};face.setPointerCapture(e.pointerId);face.focus();e.preventDefault();});
 face.addEventListener('pointermove',e=>{if(!dragging)return;const a=angleAt(e);let d=a-dragging.last;if(d>180)d-=360;if(d<-180)d+=360;dragging.last=a;dragging.carry+=d;const steps=Math.trunc(dragging.carry/6);if(steps){dragging.carry-=steps*6;roll(steps);}});
 for(const type of ['pointerup','pointercancel'])face.addEventListener(type,()=>{dragging=null;});
 face.addEventListener('wheel',e=>{e.preventDefault();roll((e.deltaY<0?1:-1)*(e.shiftKey?10:1));},{passive:false});
 face.addEventListener('keydown',e=>{const step={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10}[e.key];if(step){e.preventDefault();roll(step*(e.shiftKey?10:1));}else if(e.key==='Home'){e.preventDefault();if(state.mode==='gap')state.gap=MIN_GAP;else state.offset=0;render();}});
 // Giờ "ngay bây giờ" trôi theo thời gian thật.
 const ticker=setInterval(()=>{if(state.mode==='start'||state.count)render();},30000);
 function value(){return {minutes:state.gap,startAt:startAt()};}
 render();
 return {
  value,
  setMinutes(v){if(Number.isFinite(Number(v))&&Number(v)>=MIN_GAP){state.gap=Math.min(MAX_GAP,Math.round(Number(v)));render();}},
  setCount(n){state.count=Math.max(0,Number(n)||0);render();},
  roll,
  setMode(mode){state.mode=mode==='start'?'start':'gap';render();},
  destroy(){clearInterval(ticker);}
 };
}
