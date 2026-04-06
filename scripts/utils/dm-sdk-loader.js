/**
 * Shared Dynamic Media delivery SDK bootstrap for EDS blocks.
 * Loads dm-sdk.mjs once, runs scanDom on a subtree, and starts watchDom once per page.
 */

const DM_SDK_IMPORT = new URL('../lib/dm-sdk.mjs', import.meta.url).href;

/** @type {string} */
const LOADER_PROMISE_KEY = '__edsDmSdkLoader';

/** @type {string} */
const WATCH_STARTED_KEY = '__edsDmSdkWatching';

/**
 * @returns {Promise<typeof import('../lib/dm-sdk.mjs')>}
 */
export function loadDmSdk() {
  if (!window[LOADER_PROMISE_KEY]) {
    window[LOADER_PROMISE_KEY] = import(DM_SDK_IMPORT);
  }
  return window[LOADER_PROMISE_KEY];
}

/**
 * Resolves asset URL from a block row (Universal Editor or plain markup).
 * @param {ParentNode | null | undefined} row
 * @returns {string}
 */
export function getDmImageUrlFromRow(row) {
  if (!row) return '';
  const anchor = row.querySelector('a[href]');
  if (anchor?.href) return anchor.href;
  const img = row.querySelector('img[src]');
  if (img?.src) return img.src;
  return '';
}

/**
 * Runs DM SDK discovery on `root` and ensures MutationObserver is started once.
 * @param {ParentNode | null | undefined} root
 * @param {(img: HTMLImageElement, src: string) => void} [onFallback]
 * @returns {Promise<void>}
 */
export async function initDmSdkInRoot(root, onFallback) {
  if (!root) return;

  try {
    const sdk = await loadDmSdk();
    if (typeof sdk.scanDom === 'function') {
      sdk.scanDom(root);
    }
    if (typeof sdk.watchDom === 'function' && !window[WATCH_STARTED_KEY]) {
      sdk.watchDom();
      window[WATCH_STARTED_KEY] = true;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('DM SDK not loaded. Falling back to static image URLs.', error);
    if (typeof onFallback === 'function') {
      root.querySelectorAll?.('img[data-dm-src]')?.forEach((el) => {
        const src = el.getAttribute('data-dm-src');
        if (src) onFallback(el, src);
      });
    }
  }
}
