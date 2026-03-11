
function applyParamToPicture(picture, key, value) {
  if (!picture || !value) return;

  picture.querySelectorAll('source').forEach((source) => {
    const url = new URL(source.srcset);
    url.searchParams.set(key, value);
    source.srcset = url.toString();
  });

  const img = picture.querySelector('img');
  if (img) {
    const url = new URL(img.src);
    url.searchParams.set(key, value);
    img.src = url.toString();
  }
}

export default function decorate(block) {
  // Use exact positional indices — decorateExternalImages no longer removes sibling rows,
  // so the original model field order is preserved in block.children.
  const [imageRow, , altRow, rotationRow, presetRow] = [...block.children];

  const altText  = altRow?.querySelector('div')?.textContent?.trim() || '';
  const rotation = rotationRow?.querySelector('div')?.textContent?.trim() || '';
  const preset   = presetRow?.querySelector('div')?.textContent?.trim() || '';

  const picture = imageRow?.querySelector('picture');

  if (!picture) return;

  // Set alt text on the fallback <img>
  const img = picture.querySelector('img');
  if (img && altText) {
    img.setAttribute('alt', altText);
  }

  // Inject rotation and preset into every source URL (server-side DM transforms)
  applyParamToPicture(picture, 'rotate', rotation);
  applyParamToPicture(picture, 'preset', preset);

  // Clear the raw field rows and render only the picture
  block.textContent = '';
  block.append(picture);
}
