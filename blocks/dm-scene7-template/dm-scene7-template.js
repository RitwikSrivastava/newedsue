import { getDmImageUrlFromRow } from '../../scripts/utils/dm-sdk-loader.js';

/**
 * Scene7 template URL: pasted text (UE text field) or link from authored markup.
 * @param {Element} block
 * @param {Element | undefined} urlRow
 * @returns {string}
 */
function getTemplateUrl(block, urlRow) {
  const fromLink = getDmImageUrlFromRow(urlRow);
  if (fromLink) return fromLink;
  return getFieldText(block, 'image', urlRow)?.trim() || '';
}

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) {
    return ueRow.textContent?.trim() || '';
  }
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

/**
 * @param {string} href
 * @returns {boolean}
 */
function isScene7IsImageUrl(href) {
  try {
    const u = new URL(href);
    return /scene7\.com$/i.test(u.hostname) && /\/is\/image\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Renders a Dynamic Media / Scene7 image template URL as a plain img with src (Approach B).
 * The delivery document keeps the template reference as a link; a noscript fallback
 * preserves an anchor for environments without scripting.
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const urlRow = rows[0];
  const templateUrl = getTemplateUrl(block, urlRow);
  const altText = getFieldText(block, 'imageAlt', rows[1]);

  if (!templateUrl || !isScene7IsImageUrl(templateUrl)) {
    return;
  }

  const noscript = document.createElement('noscript');
  const fallbackLink = document.createElement('a');
  fallbackLink.href = templateUrl;
  fallbackLink.textContent = altText || 'Dynamic Media template';
  noscript.append(fallbackLink);

  const img = document.createElement('img');
  img.src = templateUrl;
  img.alt = altText || '';
  img.loading = 'lazy';
  img.decoding = 'async';

  block.textContent = '';
  block.append(noscript, img);
}
