/** Small, dependency-free ZIP writer. Files are stored verbatim; PNG is already compressed. */
export interface PackageFile { name: string; data: Uint8Array }

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

export function textPackageFile(name: string, content: string): PackageFile {
  return { name, data: encoder.encode(content) };
}

export function createStoredZip(files: PackageFile[]): Blob {
  if (!files.length || files.length > 6000) throw new Error('Choose between 1 and 6,000 package files.');
  const paths = new Set<string>();
  const pieces: BlobPart[] = [], directory: Uint8Array[] = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    if (!file.name || /(^\/|\\|\0|(^|\/)\.\.?($|\/))/.test(file.name) || paths.has(file.name)) {
      throw new Error('Every package file needs a unique, relative path.');
    }
    paths.add(file.name);
    const name = encoder.encode(file.name);
    if (name.length > 65535 || offset + file.data.length > 200_000_000) {
      throw new Error('The supplier package exceeds 200 MB. Export fewer designs at once.');
    }
    const checksum = crc32(file.data);
    const local = new Uint8Array(30 + name.length), header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true); // UTF-8 filenames.
    header.setUint16(12, 0x21, true); // 1980-01-01; reproducible archive metadata.
    header.setUint32(14, checksum, true);
    header.setUint32(18, file.data.length, true);
    header.setUint32(22, file.data.length, true);
    header.setUint16(26, name.length, true);
    local.set(name, 30);
    pieces.push(local.buffer, new Uint8Array(file.data).buffer);
    const central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer);
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, checksum, true);
    entry.setUint32(20, file.data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    directorySize += central.length;
    offset += local.length + file.data.length;
  }
  const end = new Uint8Array(22), footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, files.length, true);
  footer.setUint16(10, files.length, true);
  footer.setUint32(12, directorySize, true);
  footer.setUint32(16, offset, true);
  return new Blob([...pieces, ...directory.map((part) => new Uint8Array(part).buffer), end.buffer], { type: 'application/zip' });
}
