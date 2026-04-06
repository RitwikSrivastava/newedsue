import { buildDamUrl } from '../../scripts/utils/dam-open-apis.js';
import { getDmImageUrlFromRow, initDmSdkInRoot } from '../../scripts/utils/dm-sdk-loader.js';
import { isSvg } from '../../scripts/utils/dom.js';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) return ueRow.textContent?.trim() || '';
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

export default async function decorate(block) {
  const [imageRow, , altRow, rotationRow, presetRow] = [...block.children];

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

  block.append(img);

  await initDmSdkInRoot(block, (imgEl, src) => {
    imgEl.src = src;
  });
}
