import { state } from '../state.js';
import { sleepMs } from '../utils.js';

export function isSideFallbackAborted(abortVersion) {
  return Number(abortVersion || 0) !== Number(state.sideFallbackAbortVersion || 0);
}

export async function sleepMsWithAbort(ms, abortVersion) {
  let left = Math.max(0, Number(ms) || 0);
  while (left > 0) {
    if (isSideFallbackAborted(abortVersion)) return false;
    const chunk = Math.min(left, 500);
    await sleepMs(chunk);
    left -= chunk;
  }
  return !isSideFallbackAborted(abortVersion);
}

export function runProviderFallbackTaskSequential(prov, taskFn) {
  if (!Object.prototype.hasOwnProperty.call(state.providerFallbackQueue, prov)) {
    state.providerFallbackQueue[prov] = Promise.resolve();
  }
  if (!Object.prototype.hasOwnProperty.call(state.providerFallbackPendingCount, prov)) {
    state.providerFallbackPendingCount[prov] = 0;
  }
  state.providerFallbackPendingCount[prov] = Math.max(0, Number(state.providerFallbackPendingCount[prov] || 0)) + 1;
  const chain = state.providerFallbackQueue[prov]
    .catch(() => undefined)
    .then(() => taskFn())
    .finally(() => {
      state.providerFallbackPendingCount[prov] = Math.max(0, Number(state.providerFallbackPendingCount[prov] || 0) - 1);
    });
  state.providerFallbackQueue[prov] = chain.catch(() => undefined);
  return chain;
}
