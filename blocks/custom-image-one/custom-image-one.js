import { buildDamUrl } from '../../scripts/utils/dam-open-apis.js';
import { getDmImageUrlFromRow, initDmSdkInRoot } from '../../scripts/utils/dm-sdk-loader.js';
import { isSvg } from '../../scripts/utils/dom.js';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) return ueRow.textContent?.trim() || '';
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

/**
 * Row that holds the custom-asset image. `custom-asset-one` has image first;
 * `custom-asset-one-required` has `textAboveImage` first, then image.
 * @param {HTMLElement} block
 * @returns {Element | undefined}
 */
function getCustomAssetImageRow(block) {
  const ueImage = block.querySelector('[data-aue-prop="image"]');
  if (ueImage) return ueImage;
  const rows = [...block.children];
  const withUrl = rows.find((row) => getDmImageUrlFromRow(row));
  return withUrl || rows[0];
}

export default async function decorate(block) {
  const rows = [...block.children];
  const imageRow = getCustomAssetImageRow(block);
  // After image: optional mimetype (custom-asset-one only), then alt, rotation, preset
  const altRow = rows.find((r) => r.matches?.('[data-aue-prop="imageTitle"]'))
    || rows[2];
  const rotationRow = rows.find((r) => r.matches?.('[data-aue-prop="rotation"]'))
    || rows[3];
  const presetRow = rows.find((r) => r.matches?.('[data-aue-prop="preset"]'))
    || rows[4];

  const altText = getFieldText(block, 'imageTitle', altRow);
  const rotation = getFieldText(block, 'rotation', rotationRow);
  const preset = getFieldText(block, 'preset', presetRow);

  const rawUrl = getDmImageUrlFromRow(imageRow);
  if (!rawUrl) {
    return;
  }

  const sourceImg = imageRow?.querySelector('picture img, img');

  block.textContent = '';

  if (sourceImg && isSvg(sourceImg)) {
    let href = rawUrl;
    try {
      href = buildDamUrl(rawUrl);
    } catch (e) {
      // keep rawUrl
    }
    const img = document.createElement('img');
    img.src = href;
    img.alt = altText || '';
    img.loading = 'lazy';
    block.append(img);
    return;
  }

  let url;
  try {
    url = new URL(buildDamUrl(rawUrl), window.location.href);
  } catch (e) {
    url = new URL(rawUrl, window.location.href);
  }

  if (rotation) {
    url.searchParams.set('rotate', rotation);
  }
  if (preset) {
    url.searchParams.set('preset', preset);
  }

  const img = document.createElement('img');
  img.alt = altText || '';
  img.dataset.dmSrc = url.toString();
  img.dataset.dmOrigin = url.origin;
  // custom-image-one is always a full-width hero/banner — treat as LCP candidate.
  // data-dm-priority tells the SDK to skip LQIP and set fetchpriority=high.
  // The static fetchpriority and loading attributes work even before the SDK runs.
  img.setAttribute('data-dm-priority', '');
  img.setAttribute('fetchpriority', 'high');
  img.loading = 'eager';

  // Copy intrinsic dimensions from the source picture/img so the browser can
  // reserve space before the image loads, preventing CLS.
  // The SDK's "aspect-ratio: auto" style only kicks in when width+height attrs exist.
  const srcWidth = sourceImg?.getAttribute('width');
  const srcHeight = sourceImg?.getAttribute('height');
  if (srcWidth) img.setAttribute('width', srcWidth);
  if (srcHeight) img.setAttribute('height', srcHeight);

  block.append(img);

  await initDmSdkInRoot(block, (imgEl, src) => {
    imgEl.src = src;
  });
}
