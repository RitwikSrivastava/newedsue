import { getTextContent } from '../../scripts/utils/dom.js';

const decorate = (block) => {
  if (!block) return;

  const [iconCol, urlCol] = block.children ?? [];
  if (!iconCol || !urlCol) return;

  const anchor = urlCol.querySelector('a');
  const targetHref = anchor?.href ?? '#';
  const logoAltText = getTextContent(anchor) ?? '';

  const imgEl = iconCol.querySelector('img');
  let imgMarkup = '';

  if (imgEl != null) {
    imgMarkup = `<span class="visually-hidden">${logoAltText}</span>${imgEl?.outerHTML}`;
  }

  block.innerHTML = `<a href="${targetHref}">${imgMarkup}</a>`;
};
export default decorate;
