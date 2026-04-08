function getFirstUrlFromText(text) {
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : '';
}

function getUrlFromRow(row) {
  if (!row) return '';

  const anchor = row.querySelector('a[href]');
  if (anchor?.href) return anchor.href;

  const source = row.querySelector('source[srcset]');
  if (source?.srcset) {
    const firstCandidate = source.srcset.split(',')[0]?.trim().split(/\s+/)[0];
    if (firstCandidate) return firstCandidate;
  }

  const image = row.querySelector('img[src]');
  if (image?.src) return image.src;

  const video = row.querySelector('video[src]');
  if (video?.src) return video.src;

  return getFirstUrlFromText(row.textContent?.trim());
}

function getMimeTypeFromUrl(url) {
  try {
    const pathname = new URL(url, window.location.href).pathname.toLowerCase();
    if (pathname.endsWith('.mp4')) return 'video/mp4';
    if (pathname.endsWith('.webm')) return 'video/webm';
    if (pathname.endsWith('.ogg') || pathname.endsWith('.ogv')) return 'video/ogg';
  } catch (e) {
    // Ignore parse errors and let the browser infer type.
  }
  return '';
}

export default function decorate(block) {
  const rows = [...block.children];
  const thumbnailUrl = getUrlFromRow(rows[0]);
  const videoUrl = getUrlFromRow(rows[1]);

  if (!videoUrl) {
    return;
  }

  const video = document.createElement('video');
  video.className = 'video-player';
  video.controls = true;
  video.preload = 'metadata';
  video.playsInline = true;

  if (thumbnailUrl) {
    video.poster = thumbnailUrl;
  }

  const source = document.createElement('source');
  source.src = videoUrl;
  const mimeType = getMimeTypeFromUrl(videoUrl);
  if (mimeType) source.type = mimeType;
  video.append(source);

  const fallback = document.createElement('p');
  const fallbackLink = document.createElement('a');
  fallbackLink.href = videoUrl;
  fallbackLink.textContent = 'View video';
  fallback.append('Your browser does not support embedded videos. ', fallbackLink);

  block.textContent = '';
  block.append(video, fallback);
}
