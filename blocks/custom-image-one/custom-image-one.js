
function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) return ueRow.querySelector('div')?.textContent?.trim() || '';
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}


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
  const [imageRow, , altRow, rotationRow, presetRow] = [...block.children];

  const altText  = getFieldText(block, 'imageTitle', altRow);
  const rotation = getFieldText(block, 'rotation', rotationRow);
  const preset   = getFieldText(block, 'preset', presetRow);

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
