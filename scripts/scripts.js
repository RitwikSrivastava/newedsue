import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';
import { loadDmSdk } from './utils/dm-sdk-loader.js';
const CONTENT_ROOT_PATH = '/content/Gazal-ue-site';
/**
 * Helper function that converts an AEM path into an EDS path.
 */
export function getEDSLink(aemPath) {
  if (!aemPath) {
    return '';
  }
  let aemRoot = CONTENT_ROOT_PATH;
  if (window.hlx && window.hlx.aemRoot) {
    aemRoot = window.hlx.aemRoot;
  }
  return aemPath.replace(aemRoot, '').replace('.html', '');
}
/**
 * Gets path details from the current URL
 * @returns {object} Object containing path details
 */
export function getPathDetails() {
  const { pathname } = window.location;
  const extParts = pathname.split('.');
  const ext = extParts.length > 1 ? extParts[extParts.length - 1] : '';
  const isContentPath = pathname.startsWith('/content');
  const parts = pathname.split('/').filter(Boolean);
  const safeLangGet = (index) => {
    const val = parts[index];
    return val ? val.split('.')[0].toLowerCase() : '';
  };
  let langRegion = 'en-au';
  const ISO_2_LETTER = /^[a-z]{2}$/;
  if (window.hlx && window.hlx.isExternalSite === true) {
    const hlxLangRegion = window.hlx.langregion?.toLowerCase();
    if (hlxLangRegion) {
      langRegion = hlxLangRegion;
    } else if (parts.length >= 2) {
      const region = isContentPath ? safeLangGet(2) : safeLangGet(0);
      let language = isContentPath ? safeLangGet(3) : safeLangGet(1);
      [language] = language.split('_');
      if (ISO_2_LETTER.test(language) && ISO_2_LETTER.test(region)) {
        langRegion = `${language}-${region}`;
      }
    }
  } else {
    // Try to extract lang-region from path
    const extractedLangRegion = isContentPath ? safeLangGet(2) : safeLangGet(0);
    
    // Only use extracted value if it matches lang-region pattern (e.g., "en-au")
    if (extractedLangRegion && extractedLangRegion.includes('-')) {
      const [extractedLang, extractedRegion] = extractedLangRegion.split('-');
      if (ISO_2_LETTER.test(extractedLang) && ISO_2_LETTER.test(extractedRegion)) {
        langRegion = extractedLangRegion;
      }
    }
    // Otherwise keep default 'en-au'
  }
  let [lang, region] = langRegion.split('-');
  const isLanguageMasters = langRegion === 'language-masters';
  // Safety checks
  if (!lang || lang === '' || lang === 'language') lang = 'en';
  if (!region || region === '' || region === 'masters') region = 'au';
  if (isLanguageMasters) {
    langRegion = 'en-au';
    lang = 'en';
    region = 'au';
  }
  const prefix = pathname.substring(0, pathname.indexOf(`/${langRegion}`)) || '';
  const suffix = pathname.substring(pathname.indexOf(`/${langRegion}`) + langRegion.length + 1) || '';
  return {
    ext,
    prefix,
    suffix,
    langRegion,
    lang,
    region,
    isContentPath,
    isLanguageMasters,
  };
}
/**
 * Fetches language placeholders
 * @param {string} langRegion - Language region code
 * @returns {object} Placeholders object
 */
export async function fetchLanguagePlaceholders(langRegion) {
  const langCode = langRegion || getPathDetails()?.langRegion || 'en-au';
  try {
    const resp = await fetch(`/${langCode}/placeholders.json`);
    if (resp.ok) {
      const json = await resp.json();
      return json.data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {}) || {};
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching placeholders for lang: ${langCode}`, error);
    try {
      const resp = await fetch('/en-au/placeholders.json');
      if (resp.ok) {
        const json = await resp.json();
        return json.data?.reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {}) || {};
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching placeholders:', err);
    }
  }
  return {};
}
/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}
function isDMOpenAPIUrl(src) {
  // No `g` flag — regex literals with `g` are stateful objects shared across calls.
  // Using `g` with .test() advances lastIndex after each match, causing alternating
  // true/false results on repeated calls with the same URL.
  return /^https?:\/\/.*\/adobe\/assets\/urn:aaid:aem:/i.test(src);
}
function isScene7Url(src) {
  return /^(https?:\/\/(.*\.)?scene7\.com\/is\/image\/(.*))/i.test(src);
}

function parseDmSource(src) {
  try {
    const u = new URL(src, window.location.href);
    const scene7Match = u.pathname.match(/\/is\/image\/(.+)/i);
    if (scene7Match) {
      return {
        origin: u.origin,
        asset: scene7Match[1],
        sourceUrl: u.href,
      };
    }
    if (isDMOpenAPIUrl(src)) {
      return {
        origin: u.origin,
        asset: u.pathname.replace(/^\/+/, ''),
        sourceUrl: u.href,
      };
    }
  } catch (e) {
    // Ignore malformed URLs and skip conversion.
  }
  return null;
}

/** Franklin block root for `dm-scene7-template` only — scopes decorateExternalImages skips. */
const DM_SCENE7_TEMPLATE_BLOCK_SEL = 'div.dm-scene7-template';

/**
 * @param {Element | null} node
 * @returns {boolean}
 */
function isUnderDmScene7TemplateBlock(node) {
  return Boolean(node?.closest(DM_SCENE7_TEMPLATE_BLOCK_SEL));
}

/**
 * Build a DM SDK-managed <img> from a parsed DM source.
 * The first DM image on the page is marked as priority (likely the LCP hero):
 *   - data-dm-priority  → SDK injects <link rel="preload"> immediately and
 *                         sets fetchpriority=high, skipping lazy loading.
 *   - fetchpriority=high → browser honours high priority even before SDK runs.
 * Every other image gets loading=lazy so off-screen images don't compete.
 */
function buildDmImg(parsed, altText, isPriority) {
  const img = document.createElement('img');
  img.dataset.dmSrc = parsed.asset;
  img.dataset.dmOrigin = parsed.origin;
  img.dataset.dmSourceUrl = parsed.sourceUrl;
  if (isPriority) {
    img.setAttribute('data-dm-priority', '');
    img.setAttribute('data-dm-role', 'hero');
    img.setAttribute('fetchpriority', 'high');
  } else {
    img.setAttribute('loading', 'lazy');
  }
  if (altText) img.alt = altText;
  return img;
}

/**
 * Converts Scene7 and DM Open API image sources to SDK-managed img elements.
 * Handles both anchor links (<a href="…scene7…">) and picture elements
 * (<picture><source srcset="…scene7…"></picture>).
 *
 * The DM delivery SDK (dm-sdk.mjs) handles adaptive URL construction, LQIP,
 * lazy loading, and resize upgrades via data-dm-src / data-dm-origin attributes.
 *
 * Scene7 / OpenAPI anchors inside `div.dm-scene7-template` are skipped so only that
 * block handles them (Approach B). All other anchors are unchanged.
 * @param {Element} main
 */
export function decorateExternalImages(main) {
  // Track whether we have seen the first DM image yet (priority/LCP candidate).
  let firstDmImage = true;

  // 1. Anchor links whose href points to a DM asset.
  main.querySelectorAll('a[href]').forEach((a) => {
    // dm-scene7-template block only — keep anchor until that block's decorate() runs.
    if (isUnderDmScene7TemplateBlock(a)) return;
    if (!isScene7Url(a.href) && !isDMOpenAPIUrl(a.href)) return;
    const parsed = parseDmSource(a.href);
    if (!parsed) return;

    preconnectOrigin(parsed.origin);
    const altText = a.innerText.trim();
    const img = buildDmImg(parsed, altText !== a.href ? altText : '', firstDmImage);
    firstDmImage = false;
    a.replaceWith(img);
  });

  // 2. Picture elements whose source srcset or fallback img.src points to a DM asset.
  main.querySelectorAll('picture').forEach((picture) => {
    if (isUnderDmScene7TemplateBlock(picture)) return;
    // Prefer the first DM source candidate from <source srcset>.
    let dmSrc = '';
    for (const source of picture.querySelectorAll('source')) {
      const candidate = (source.srcset || '').split(',')[0].trim().split(/\s+/)[0];
      if (candidate && (isScene7Url(candidate) || isDMOpenAPIUrl(candidate))) {
        dmSrc = candidate;
        break;
      }
    }
    // Fall back to the <img src> inside the picture.
    if (!dmSrc) {
      const innerImg = picture.querySelector('img');
      const src = innerImg?.src || '';
      if (isScene7Url(src) || isDMOpenAPIUrl(src)) dmSrc = src;
    }
    if (!dmSrc) return;

    const parsed = parseDmSource(dmSrc);
    if (!parsed) return;

    preconnectOrigin(parsed.origin);
    const innerAlt = picture.querySelector('img')?.alt || '';
    const img = buildDmImg(parsed, innerAlt, firstDmImage);
    firstDmImage = false;
    picture.replaceWith(img);
  });
}

/**
 * Inject a <link rel="preconnect"> to the given origin if one doesn't exist.
 * Called before image requests begin so the DNS+TLS handshake can overlap
 * with script evaluation rather than serialising after it.
 */
function preconnectOrigin(origin) {
  if (!origin || document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  link.crossOrigin = '';
  document.head.appendChild(link);
}

/**
 * After eager-section blocks have executed they may have produced img[data-dm-src]
 * elements (e.g. custom-image-one) that were invisible to decorateExternalImages(),
 * which runs before block JS. Scan for those and:
 *   1. Preconnect to each unique DM origin.
 *   2. Mark the very first untagged DM image as the LCP candidate so the SDK
 *      treats it with fetchpriority=high and skips lazy loading / LQIP.
 */
function promoteFirstBlockDmImage(root) {
  const alreadyHasPriority = root.querySelector('img[data-dm-priority]');
  root.querySelectorAll('img[data-dm-src]').forEach((img) => {
    const origin = img.dataset.dmOrigin;
    if (origin) preconnectOrigin(origin);
  });
  if (alreadyHasPriority) return;
  const first = root.querySelector('img[data-dm-src]:not([data-dm-priority]):not([data-dm-auto-priority])');
  if (!first) return;
  first.setAttribute('data-dm-priority', '');
  first.setAttribute('fetchpriority', 'high');
  first.removeAttribute('loading');
}

async function activateDmSdk(root) {
  if (!root) return;
  try {
    const sdk = await loadDmSdk();
    if (typeof sdk.scanDom === 'function') {
      // One rAF is enough: the frame fires after layout, giving the SDK accurate
      // container widths for dimension stamping and URL construction.
      // The removed setTimeout(300) was a duplicate — the SDK marks images as
      // data-dm-managed after the first scan so repeated calls are no-ops, but
      // they still waste a timer slot and main-thread scheduling overhead.
      requestAnimationFrame(() => sdk.scanDom(root));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[DM SDK] Failed to load for external images.', err);
    root.querySelectorAll('img[data-dm-src]').forEach((img) => {
      if (img.getAttribute('src')) return;
      img.src = img.dataset.dmSourceUrl || img.dataset.dmSrc;
    });
  }
}
export function decorateImages(main) {
  main.querySelectorAll('p img').forEach((img) => {
    const p = img.closest('p');
    p.className = 'img-wrapper';
  });
}
// export function decorateImagesWithWidthHeight(main) {
//   const urlSpec = window.location.href.endsWith('test-page');
//   if (urlSpec) {
//     main.querySelectorAll('img').forEach((img) => {
//       img.width = '1620';
//       img.height = '1080';
//     });
//   }
// }
/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}
/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}
/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}
/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  // decorateButtons(main); // Commented out - blocks handle their own button styling
  decorateIcons(main);
  decorateExternalImages(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}
/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');

    // Start the SDK import immediately and in parallel with section loading.
    //
    // Why: after decorateExternalImages() all DM images have data-dm-src but no src.
    // Images with no src report img.complete === true in all browsers, so
    // waitForFirstImage() would resolve instantly — before the first image actually
    // has a src to load. By firing activateDmSdk() without awaiting it first, the
    // dynamic import of dm-sdk.mjs overlaps with loadSection(), giving the SDK the
    // best possible chance to set el.src before waitForFirstImage() resolves and
    // before the browser measures LCP.
    const sdkReady = activateDmSdk(main);
    await loadSection(main.querySelector('.section'), waitForFirstImage);
    // Blocks (e.g. custom-image-one) create img[data-dm-src] elements during
    // loadSection, AFTER decorateExternalImages() has already run. Promote the
    // first such image to LCP priority so the SDK treats it with fetchpriority=high,
    // and preconnect to every DM origin found so TCP/TLS overlaps with script work.
    promoteFirstBlockDmImage(main);
    await sdkReady;
  }
  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}
/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));
  const main = doc.querySelector('main');
  await loadSections(main);
  // activateDmSdk is intentionally omitted here. The SDK's watchDom() MutationObserver
  // (started automatically during SDK self-init) already catches img[data-dm-src] elements
  // added by lazy-loaded blocks. A second activation would fire up to two more scanDom
  // calls (rAF) against images that are already managed (data-dm-managed="true").

  // After lazy sections load, check if any new DM images landed in the viewport
  // (e.g. image-and-text-container on mobile) that weren't promoted during loadEager
  // because they didn't exist yet. This ensures the first visible lazy-section image
  // gets fetchpriority=high and preconnects are fired for new origins.
  promoteFirstBlockDmImage(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();
  loadFooter(doc.querySelector('footer'));
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}
/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}
async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}
// Initialize eds_config for widgets
if (!window.eds_config) {
  window.eds_config = {
    widgets: {
      env: 'production',
      login: {
        oauthInitBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qfa-qff-oauth-login/master/0.0.0/oauth.js',
        oauthBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qdd-oauth-login/master/0.0.0/bundle.js',
        oauthLoginRibbonBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qdd-login-ribbon/master/0.0.0/bundle.js'
      },
      shopping_cart: {
        scriptPath: 'https://static.qcom-stg.qantastesting.com/ams02/a974/62/dev/eds-master/shoppingcart_widget/current/app.js'
      }
    },
    regional_selector: {
      flags: {
        'en-au': 'runway_country_flag_australia',
        'en-us': 'runway_country_flag_united_states',
        'en-gb': 'runway_country_flag_united_kingdom',
        'en-nz': 'runway_country_flag_new_zealand'
      }
    }
  };
}
loadPage();