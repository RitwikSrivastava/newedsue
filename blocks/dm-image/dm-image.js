const DM_SDK_ESM_URL = '../../scripts/lib/dm-sdk.mjs';
const DM_SDK_PROMISE_KEY = '__edsDmSdkLoader';
const DM_SDK_WATCH_KEY = '__edsDmSdkWatching';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) {
    return ueRow.textContent?.trim() || '';
  }
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

function getImageUrl(imageRow) {
  if (!imageRow) {
    return '';
  }

  const anchor = imageRow.querySelector('a[href]');
  if (anchor?.href) {
    return anchor.href;
  }

  const img = imageRow.querySelector('img[src]');
  if (img?.src) {
    return img.src;
  }

  return '';
}

function toBoolean(value) {
  return /^true$/i.test(value || '');
}

function loadDmSdk() {
  if (!window[DM_SDK_PROMISE_KEY]) {
    window[DM_SDK_PROMISE_KEY] = import(DM_SDK_ESM_URL);
  }
  return window[DM_SDK_PROMISE_KEY];
}

function applyOptionalDataset(img, name, value) {
  if (value) {
    img.dataset[name] = value;
  }
}

export default async function decorate(block) {
  const rows = [...block.children];
  const imageRow = rows[0];
  // Row order: image, imageMimeType, imageAlt, origin, priority, preset, smartCrop, role
  const altText = getFieldText(block, 'imageAlt', rows[2]);
  const configuredOrigin = getFieldText(block, 'origin', rows[3]);
  const priority = getFieldText(block, 'priority', rows[4]);
  const preset = getFieldText(block, 'preset', rows[5]);
  const smartCrop = getFieldText(block, 'smartCrop', rows[6]);
  const role = getFieldText(block, 'role', rows[7]);
  const imageUrl = getImageUrl(imageRow);

  if (!imageUrl) {
    return;
  }

  const img = document.createElement('img');
  img.alt = altText || '';
  img.loading = 'lazy';
  img.dataset.dmSrc = imageUrl;

  if (toBoolean(priority)) {
    img.dataset.dmPriority = '';
    img.loading = 'eager';
    img.fetchPriority = 'high';
  }

  applyOptionalDataset(img, 'dmPreset', preset);
  applyOptionalDataset(img, 'dmSmartcrop', smartCrop);
  applyOptionalDataset(img, 'dmRole', role);

  if (configuredOrigin) {
    img.dataset.dmOrigin = configuredOrigin;
  } else {
    try {
      img.dataset.dmOrigin = new URL(imageUrl).origin;
    } catch (e) {
      // Ignore origin extraction for relative URLs.
    }
  }

  block.textContent = '';
  block.append(img);

  try {
    const sdk = await loadDmSdk();
    if (typeof sdk?.scanDom === 'function') {
      sdk.scanDom(block);
    }
    if (typeof sdk?.watchDom === 'function' && !window[DM_SDK_WATCH_KEY]) {
      sdk.watchDom();
      window[DM_SDK_WATCH_KEY] = true;
    }
  } catch (error) {
    // Keep image visible when SDK is unavailable.
    // eslint-disable-next-line no-console
    console.warn('DM SDK not loaded. Falling back to static image URL.', error);
    img.src = imageUrl;
  }
}
