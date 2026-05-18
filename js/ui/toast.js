/**
 * Toast notifikace.
 * Deps: CONFIG, logError
 */
export function createToastApi({ CONFIG, logError }) {
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.pointerEvents = 'none';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, CONFIG.TOAST_DURATION);
  }

  function showToastWithAction(msg, actionLabel, onClick) {
    const el = document.getElementById('toast');
    el.textContent = '';
    const span = document.createElement('span');
    span.textContent = msg + ' ';
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.style.cssText = 'margin-left:10px;background:var(--acc2);border:1px solid var(--acc);color:var(--acc3);padding:3px 10px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:inherit';
    btn.onclick = () => {
      el.style.opacity = '0';
      try { onClick(); } catch (e) { logError('toastAction', e); }
    };
    el.appendChild(span);
    el.appendChild(btn);
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, CONFIG.TOAST_DURATION * 2);
  }

  return { showToast, showToastWithAction };
}
