import { getDmImageUrlFromRow, initDmSdkInRoot } from '../../scripts/utils/dm-sdk-loader.js';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) {
    return ueRow.textContent?.trim() || '';
  }
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

function toBoolean(value) {
  return /^true$/i.test(value || '');
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
  const imageUrl = getDmImageUrlFromRow(imageRow);

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

  await initDmSdkInRoot(block, (imgEl, src) => {
    imgEl.src = src;
  });
}
