/* eslint-disable brace-style */
import {
  getTextContent,
  createElementWithClasses,
  isFieldTrue,
  isSvg,
} from '../../scripts/utils/dom.js';
import { buildDamUrl } from '../../scripts/utils/dam-open-apis.js';
import { getDmImageUrlFromRow, initDmSdkInRoot } from '../../scripts/utils/dm-sdk-loader.js';
import { EVENT_NAME, triggerBlockCardClick } from '../../scripts/martech/datalayer.js';
import {
  attachTestId,
  getTitleStyleClass,
  isExternalLink,
} from '../../scripts/utils/common-utils.js';

// Title classes for different layouts based on tags with or without offset section
const titleClasses = {
  'layout-3-col': {
    default: { h2: 'display-03' },
  },
  'layout-4-col': {
    default: { h2: 'title-01', h3: 'title-01' },
  },
};

/*
 * Apply styles for the config option - Image Alignment
 */
function getImageAlignmentClasses(blockStyles, index) {
  const classes = [];

  // Option: All Left Aligned
  if (blockStyles.includes('all-left-aligned')) {
    classes.push('image-left');
  }

  // Option: All Right Aligned
  else if (blockStyles.includes('all-right-aligned')) {
    classes.push('image-right');
  }

  // Option: Alternate Left Aligned
  else if (blockStyles.includes('alternate-left-aligned')) {
    classes.push(index % 2 === 0 ? 'image-left' : 'image-right');
  }

  // Option: Alternate Right Aligned
  else {
    classes.push(index % 2 === 0 ? 'image-right' : 'image-left');
  }

  return classes;
}

/*
 * Apply extra classes to the items for styling
 */
function getExtraClassesForItem(numOfColumns, numOfItems, itemIndex, blockStyles) {
  const classes = [];

  // Layout - 1 Column
  if (numOfColumns === 1) {
    if (itemIndex === 0 && blockStyles.includes('first-article-highlighted')) {
      classes.push('highlighted');
    }
    classes.push(...getImageAlignmentClasses(blockStyles, itemIndex));
  }

  // Last Item
  if (itemIndex === numOfItems - 1) {
    classes.push('last-item');
  }
  return classes;
}

function attachTestIdToElements(block) {
  const elementsToAttach = [
    { selector: '.imagetext-title', elementName: 'heading' },
    { selector: '.imagetext-heading-container', elementName: 'heading-container' },
    { selector: '.imagetext-category', elementName: 'category' },
    { selector: '.imagetext-content-container', elementName: 'content-container' },
    { selector: '.imagetext-badge', elementName: 'badge' },
    { selector: '.imagetext-image-container', elementName: 'image-container' },
    { selector: '.imagetext-image-container img', elementName: 'image' },
    { selector: '.imagetext-caption', elementName: 'caption' },
    { selector: '.imagetext-intro-text', elementName: 'intro' },
    { selector: '.imagetext-body-text', elementName: 'body' },
    { selector: '.imagetext-links-container', elementName: 'links-container' },
    { selector: '.imagetext-links-container a', elementName: 'link' },
  ];

  elementsToAttach.forEach(({ selector, elementName }) => {
    attachTestId({ block, selector, elementName });
  });
}

/*
 * Decorate Image and Text Item
 */
async function decorateItem(parentBlock, block, layoutClass, classes = []) {
  const [
    image,
    hideAltText,
    caption,
    badge,
    category,
    title,
    introText,
    bodyText,
    ctas,
    campaignCode,
  ] = block.children;

  const smartCrops = classes.includes('highlighted')
    ? { all: { crop: 'generic-4x5', layout: layoutClass } }
    : { all: { crop: 'generic-3x2', layout: layoutClass } };

  const highlighted = classes.includes('highlighted');
  const dmImgMarkup = buildImageAndTextDmMarkup(image, {
    smartCropName: smartCrops.all.crop,
    dmRole: highlighted ? 'hero' : 'content',
    eager: highlighted,
    excludeAltText: isFieldTrue(hideAltText),
  });

  // Apply extra classes to text elements
  const titleEle = title?.querySelector('h2, h3, h4');
  if (titleEle) {
    const titleClass = getTitleStyleClass(parentBlock, titleEle.tagName, titleClasses);
    titleEle.classList.add('imagetext-title');
    if (titleClass) titleEle.classList.add(titleClass);
  }

  introText?.classList.add('imagetext-intro-text', 'intro');
  bodyText?.classList.add('imagetext-body-text', 'body-01');

  // Reset DOM
  block.classList.add('image-and-text', ...(classes || []));

  // Build DOM
  const getHeadingContainerHTML = () => {
    const categoryContent = getTextContent(category);
    const titleContent = getTextContent(title);

    if (!categoryContent && !titleContent) return '';
    return `<div class="imagetext-heading-container">
        ${categoryContent ? ` <span class="imagetext-category caption">${categoryContent}</span>` : ''}
        ${titleContent ? title.innerHTML : ''}
      </div>`;
  };

  // Links
  const buildLinkElements = () => {
    const anchors = ctas.querySelectorAll('a');
    const linksContainer = createElementWithClasses(
      'div',
      'imagetext-links-container',
      'body-01',
    );

    anchors.forEach((anchor) => {
      // Get link text and URL
      anchor.classList.add('standalone');

      // Check if link is external
      const isExternal = isExternalLink(anchor.href);

      if (isExternal) {
        anchor.classList.add('standalone--external');
      }
      anchor.setAttribute('data-wae-event', EVENT_NAME.BLOCK_CARD_CLICK);
      anchor.setAttribute('data-wae-block-type', 'image_and_text');
      anchor.setAttribute('data-wae-card-title', getTextContent(title));
      anchor.setAttribute('data-wae-internal-campaign-id', getTextContent(campaignCode));

      anchor.addEventListener('click', () =>
        triggerBlockCardClick(
          'image_and_text',
          getTextContent(title),
          anchor.href,
          anchor.textContent || anchor.innerText,
          getTextContent(campaignCode),
        ),
      );
      linksContainer.appendChild(anchor);
    });
    return linksContainer.outerHTML;
  };

  const hasCaption = getTextContent(caption);
  const hasBadge = getTextContent(badge);
  const headingContainerHTML = getHeadingContainerHTML();
  const introHTML = getTextContent(introText) ? introText.outerHTML : '';
  const bodyHTML = getTextContent(bodyText) ? bodyText.outerHTML : '';
  const badgeHTML = hasBadge
    ? `<div class="imagetext-badge"><span>${hasBadge}</span></div>`
    : '';
  const captionHTML = hasCaption
    ? `<figcaption class="imagetext-caption caption">${hasCaption}</figcaption>`
    : '';

  const linksHTML = getTextContent(ctas) ? buildLinkElements(ctas) : '';

  const contentContainer = `
    <div class="imagetext-content-container${hasCaption ? ' with-caption' : ''}">
      ${headingContainerHTML}
      ${introHTML}
      ${bodyHTML}
      ${linksHTML}
    </div>
  `;

  const imageContainer = dmImgMarkup ? `
    <figure class="imagetext-image-container">
      ${badgeHTML}
      ${dmImgMarkup}
      ${captionHTML}
    </figure>
  ` : '';

  block.innerHTML = classes.includes('image-right')
    ? `${contentContainer}${imageContainer}`
    : `${imageContainer}${contentContainer}`;

  return block;
}

/*
 * Main function to decorate the Image and Text Container
 */
export default async function decorateContainer(block) {
  const blockStyles = [];

  const imageAndTextItems = [];
  let numOfColumns = 1;
  let layoutClass = null;

  // Get styles from single row items
  [...block.children].forEach((containerItem) => {
    if (containerItem.children.length === 1) {
      const textContent = containerItem.textContent.trim();
      if (textContent) {
        // Add the column/layout class to block
        block.classList.add(textContent);
        blockStyles.push(textContent);

        // Get the selected column option to check if it's stacked
        const layoutStyleMatch = textContent.match(/^layout-([0-9])-col$/);
        if (layoutStyleMatch) {
          layoutClass = textContent;
          numOfColumns = parseInt(layoutStyleMatch[1], 10);
        }
      }
      return;
    }
    // If not a single row item, it's an Image and Text Block
    imageAndTextItems.push(containerItem);
  });

  // If more items > columns, apply the stacked class
  if (imageAndTextItems.length > numOfColumns) {
    blockStyles.push('stacked');
  }

  // Decorate Image and Text Blocks
  const imageTextWrapper = createElementWithClasses('div', 'image-text-wrapper');

  const listItems = await Promise.all(
    imageAndTextItems.map(async (imageAndTextItem, index) => {
      const classes = getExtraClassesForItem(
        numOfColumns,
        imageAndTextItems.length,
        index,
        blockStyles,
      );

      return decorateItem(block, imageAndTextItem, layoutClass, classes);
    }),
  );

  imageTextWrapper.append(...listItems);
  // Clearing the block's content
  block.innerHTML = '';
  // Append the generated content to the block
  block.append(imageTextWrapper);
  // Add extra style and layout classes as needed
  block.classList.add(...blockStyles);

  // testing requirement - set attribute 'data-testid' for elements
  attachTestIdToElements(block);

  await initDmSdkInRoot(imageTextWrapper, (imgEl, src) => {
    imgEl.src = src;
  });
}

/**
 * Escape text for use in double-quoted HTML attributes.
 * @param {string | null | undefined} value
 * @returns {string}
 */
function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Build a DM SDK-managed img (or static SVG img) for image-and-text.
 * @param {HTMLElement} imageCell
 * @param {{ smartCropName: string, dmRole: string, eager: boolean, excludeAltText: boolean }} options
 * @returns {string} HTML snippet or empty string
 */
function buildImageAndTextDmMarkup(imageCell, options) {
  const {
    smartCropName,
    dmRole,
    eager,
    excludeAltText,
  } = options;

  const rawUrl = getDmImageUrlFromRow(imageCell);
  if (!rawUrl) {
    return '';
  }

  const sourceImg = imageCell.querySelector('img');
  const alt = excludeAltText ? '' : (sourceImg?.getAttribute('alt')?.trim() || '');

  if (sourceImg && isSvg(sourceImg)) {
    let href = rawUrl;
    try {
      href = buildDamUrl(rawUrl);
    } catch (e) {
      // keep rawUrl
    }
    return `<img class="imagetext-dm-image" src="${escapeHtmlAttr(href)}" alt="${escapeHtmlAttr(alt)}" loading="lazy" />`;
  }

  let imageUrl;
  try {
    imageUrl = buildDamUrl(rawUrl);
  } catch (e) {
    return '';
  }

  let dmSrc;
  let origin;
  try {
    const u = new URL(imageUrl, window.location.href);
    origin = u.origin;
    dmSrc = u.toString();
  } catch (e) {
    return '';
  }

  const roleAttr = dmRole
    ? ` data-dm-role="${escapeHtmlAttr(dmRole)}"`
    : '';

  if (eager) {
    return `<img class="imagetext-dm-image" alt="${escapeHtmlAttr(alt)}" data-dm-src="${escapeHtmlAttr(dmSrc)}" data-dm-origin="${escapeHtmlAttr(origin)}" data-dm-smartcrop="${escapeHtmlAttr(smartCropName)}"${roleAttr} data-dm-priority="" loading="eager" fetchpriority="high" />`;
  }

  return `<img class="imagetext-dm-image" alt="${escapeHtmlAttr(alt)}" data-dm-src="${escapeHtmlAttr(dmSrc)}" data-dm-origin="${escapeHtmlAttr(origin)}" data-dm-smartcrop="${escapeHtmlAttr(smartCropName)}"${roleAttr} loading="lazy" />`;
}
