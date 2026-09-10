import { crc32 } from './zip';

/** Canvas defaults to 96 dpi; record the physical resolution used for the pixels. */
export function setPngResolution(png: Uint8Array, dpi: number): Uint8Array {
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs.
  view.setUint32(8, Math.round(dpi / 0.0254));
  view.setUint32(12, Math.round(dpi / 0.0254));
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const pieces = [png.subarray(0, 8)];
  const input = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = input.getUint32(offset) + 12;
    if (offset + length > png.length) throw new Error('PNG data is incomplete.');
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') pieces.push(png.subarray(offset, offset + length));
    if (type === 'IHDR') pieces.push(chunk);
    offset += length;
  }
  const result = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let cursor = 0;
  for (const piece of pieces) { result.set(piece, cursor); cursor += piece.length; }
  return result;
}
