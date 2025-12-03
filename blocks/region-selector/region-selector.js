import { getPathDetails } from '../../scripts/scripts.js';

const decorate = async (block) => {
  // Fail check
  if (!block) return;

  // Try to get URL from either <a> tag or text field
  let regionSelectionUrl = '/en-au/region-selection'; // default
  
  const anchor = block?.querySelector('a');
  if (anchor) {
    regionSelectionUrl = anchor.href;
  } else {
    // If no anchor, try to get text content as URL
    const textContent = block.textContent?.trim();
    if (textContent) {
      regionSelectionUrl = textContent;
    }
  }

  const { lang, region, langRegion } = getPathDetails();

  const regionSelectorFlag =
    window.eds_config?.regional_selector?.flags[langRegion] || 'runway_country_flag_australia';

  const codeBasePath = window.hlx?.codeBasePath || '';

  // Build final markup with fallback text
  block.innerHTML = `
    <a href="${regionSelectionUrl}" class="region-selector-anchor body-02" aria-labelledby="regionSelector">
      <span id="regionSelector" class="visually-hidden">Change country and language. Current selection: ${region.toUpperCase()} ${lang.toUpperCase()}</span>
      <span class="flag" aria-hidden="true">
        <img src="${codeBasePath}/icons/${regionSelectorFlag}.svg" alt="">
      </span>
      <span class="region-label" aria-hidden="true">${region.toUpperCase()}  |  ${lang.toUpperCase()}</span>
    </a>
  `;
};

export default decorate;
