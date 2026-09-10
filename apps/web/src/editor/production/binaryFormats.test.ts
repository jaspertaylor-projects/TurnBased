/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { crc32 as standardCrc32, deflateSync, inflateSync } from 'node:zlib';
import { createStoredZip, textPackageFile } from './zip';
import { setPngResolution } from './pngResolution';

const pythonAvailable = !spawnSync('python3', ['--version']).error;

test(
  'Python ZIP reader verifies every entry, UTF-8 path and checksum in a supplier archive',
  {
    skip: pythonAvailable ? false : 'Python 3 standard library is required for independent ZIP verification.',
  },
  async () => {
    const files = [
      textPackageFile('START-HERE.html', '<h1>Moonlit Market — supplier review</h1>'),
      textPackageFile('artwork/01-Münzen/coin.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
      { name: 'artwork/01-Münzen/coin.png', data: Uint8Array.from([0, 255, 128, 42, 10, 13]) },
    ];
    const blob = createStoredZip(files);
    assert.equal(blob.type, 'application/zip');
    const checked = spawnSync(
      'python3',
      [
        '-c',
        `
import hashlib, io, json, sys, zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    assert archive.testzip() is None
    print(json.dumps([{
        'name': entry.filename,
        'bytes': entry.file_size,
        'method': entry.compress_type,
        'utf8': bool(entry.flag_bits & 0x800),
        'sha256': hashlib.sha256(archive.read(entry)).hexdigest(),
    } for entry in archive.infolist()]))
`,
      ],
      { input: Buffer.from(await blob.arrayBuffer()), encoding: 'utf8' },
    );
    assert.equal(checked.status, 0, checked.stderr);
    assert.deepEqual(
      JSON.parse(checked.stdout),
      files.map((file) => ({
        name: file.name,
        bytes: file.data.length,
        method: 0,
        utf8: true,
        sha256: createHash('sha256').update(file.data).digest('hex'),
      })),
    );
  },
);

function pngChunk(type: string, payload: Uint8Array): Buffer {
  const name = Buffer.from(type, 'ascii');
  const size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  crc.writeUInt32BE(standardCrc32(Buffer.concat([name, payload])));
  return Buffer.concat([size, name, payload, crc]);
}

test('PNG resolution changes retain decodable RGBA pixels and valid standard CRCs', () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6; // One 8-bit RGBA pixel.
  const scanline = Buffer.from([0, 17, 170, 238, 255]);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanline)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  const original = Buffer.from(png);
  // Replacing an existing resolution must not append duplicate pHYs chunks.
  const output = Buffer.from(setPngResolution(setPngResolution(png, 96), 300));
  assert.deepEqual(png, original);
  assert.deepEqual(output.subarray(0, 8), original.subarray(0, 8));
  const chunks: Array<{ type: string; data: Buffer }> = [];
  for (let offset = 8; offset < output.length; ) {
    const length = output.readUInt32BE(offset);
    const type = output.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + length + 12 <= output.length);
    const data = output.subarray(offset + 8, offset + 8 + length);
    assert.equal(
      output.readUInt32BE(offset + 8 + length),
      standardCrc32(output.subarray(offset + 4, offset + 8 + length)),
    );
    chunks.push({ type, data });
    offset += length + 12;
  }
  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ['IHDR', 'pHYs', 'IDAT', 'IEND'],
  );
  assert.deepEqual(chunks[0].data, header);
  const resolution = chunks[1].data;
  assert.equal(resolution[8], 1); // Pixels per meter, not unspecified units.
  assert.ok(Math.abs(resolution.readUInt32BE(0) * 0.0254 - 300) < 0.01);
  assert.equal(resolution.readUInt32BE(0), resolution.readUInt32BE(4));
  assert.deepEqual(inflateSync(chunks[2].data), scanline);
});
