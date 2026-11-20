// The task owns its state. Animation is purely visual.
const activity = {
  panel: document.getElementById('activity'),
  label: document.getElementById('activityLabel'),
  detail: document.getElementById('activityDetail'),
  issue: '',
  start() {
    this.issue = '';
    this.show('running', 'Đang chạy', 'Đang chuẩn bị…');
  },
  progress(text) {
    if (this.panel.dataset.state === 'running') this.detail.textContent = text;
  },
  fail(text) {
    this.issue = text;
  },
  finish() {
    if (this.issue) this.show('error', 'Gặp lỗi', this.issue);
    else this.show('sleeping', 'Đang nghỉ', 'Đã xong thao tác.');
  },
  show(state, label, detail) {
    this.panel.dataset.state = state;
    this.label.textContent = label;
    this.detail.textContent = detail;
  }
};

if (globalThis.chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'profileProgress' && sender.tab?.id === tabId && busy && liveScanId && message.scanId===liveScanId) {
      receivePreviews(message.rows);
      $('pageCount').textContent='Đã hiển thị '+pending.size+'/'+(message.total??'?')+' bài';
      $('status').textContent='Đang quét · '+message.count+'/30 bài trong lượt này.';
      activity.progress('Đang quét profile · tìm thấy ' + message.count + '/30 bài trong lượt này.');
    }
  });
}
