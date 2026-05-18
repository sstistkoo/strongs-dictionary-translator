import { state } from '../state.js';

export function startResize(e) {
  if (window.innerWidth > 600) return;
  e.preventDefault();
  state.resizing = true;
  state.startY = e.touches ? e.touches[0].clientY : e.clientY;
  const split = document.querySelector('.split');
  const listPane = document.querySelector('.list-pane');
  const logPanel = document.querySelector('.log-panel');
  const detailScroll = document.querySelector('.detail-scroll');
  state.startLogHeight = logPanel.offsetHeight;
  state.startDetailHeight = detailScroll.offsetHeight;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', doResize);
  document.addEventListener('touchend', stopResize);
}

export function doResize(e) {
  if (!state.resizing) return;
  const currY = e.touches ? e.touches[0].clientY : e.clientY;
  const delta = currY - state.startY;
  const split = document.querySelector('.split');
  const listPane = document.querySelector('.list-pane');
  const logPanel = document.querySelector('.log-panel');
  const detailScroll = document.querySelector('.detail-scroll');
  const availHeight = split.offsetHeight;
  const listPaneHeight = listPane.offsetHeight;
  const newLog = Math.max(50, Math.min(state.startLogHeight + delta, availHeight - listPaneHeight - 120));
  const newDetail = Math.max(50, availHeight - listPaneHeight - newLog);
  logPanel.style.height = newLog + 'px';
  detailScroll.style.height = newDetail + 'px';
  logPanel.style.flex = 'none';
  detailScroll.style.flex = 'none';
}

export function stopResize() {
  state.resizing = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', doResize);
  document.removeEventListener('touchend', stopResize);
}
