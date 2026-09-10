import { setPngResolution } from './pngResolution';

async function decodeImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      image.src = '';
      reject(new Error('Artwork decoding timed out. Upload a fresh image and retry.'));
    }, 20000);
    image.onload = () => { window.clearTimeout(timer); resolve(); };
    image.onerror = () => { window.clearTimeout(timer); reject(new Error('An artwork image could not be decoded. Upload a valid image before exporting.')); };
    image.src = source;
  });
  return image;
}

/** Render the same SVG seen in the editor, without losing linked artwork silently. */
export async function rasterizeProductionSvg(svg: string, widthMm: number, heightMm: number): Promise<{ png: Uint8Array; svg: string }> {
  const width = Math.round(widthMm / 25.4 * 300), height = Math.round(heightMm / 25.4 * 300);
  if (width < 1 || height < 1 || width > 16000 || height > 16000 || width * height > 40_000_000) {
    throw new Error('This face is too large for a 300 dpi PNG. Use its vector export or a smaller component.');
  }
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('The component artwork could not be read.');
  for (const image of document.querySelectorAll('image')) {
    const source = image.getAttribute('href') ?? '';
    if (!source) continue;
    if (source.startsWith('data:')) {
      await decodeImage(source);
      continue;
    }
    // A browser can display an external image in a live SVG but omit it when
    // the SVG is used as an image. Embed it explicitly or fail the whole export.
    const response = await fetch(source, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('A linked image could not be downloaded. Upload it to the template and retry.');
    const blob = await response.blob();
    if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type) || blob.size > 15_000_000) {
      throw new Error('A linked image needs to be a PNG, JPEG, WebP or GIF below 15 MB.');
    }
    const embedded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not embed a linked image.'));
      reader.readAsDataURL(blob);
    });
    await decodeImage(embedded);
    image.setAttribute('href', embedded);
  }
  const portableSvg = new XMLSerializer().serializeToString(document);
  document.documentElement.setAttribute('width', String(width));
  document.documentElement.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' }));
  try {
    const image = await decodeImage(url);
    const canvas = window.document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export is unavailable in this browser.');
    context.drawImage(image, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
    canvas.width = 1; canvas.height = 1;
    return { png: setPngResolution(new Uint8Array(await png.arrayBuffer()), 300), svg: portableSvg };
  } finally { URL.revokeObjectURL(url); }
}
