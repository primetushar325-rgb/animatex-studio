// ============================================================================
// Minimal GIF89a encoder (pure TypeScript, no dependencies)
// ----------------------------------------------------------------------------
// Encodes RGBA frames into an animated GIF with a global 256-colour palette.
// Fast enough for cartoon frames: palette built from 4-bit RGB buckets, each
// pixel mapped through a 4096-entry lookup table (no per-pixel search).
// Used for mobile-friendly exports (GIFs play everywhere, incl. iOS Photos).
// ============================================================================

export interface GIFFrame {
  width: number;
  height: number;
  /** RGBA8 pixels, length = width*height*4 */
  data: Uint8ClampedArray;
  /** delay in milliseconds */
  delayMs: number;
}

function write16(out: number[], v: number) {
  out.push(v & 0xff, (v >> 8) & 0xff);
}

// --- LZW compression (GIF variant) -----------------------------------------

function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const maxCode = (1 << codeSize) - 1;
  let nextCode = endCode + 1;

  const dict = new Map<number, number>();
  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  const resetDict = () => {
    dict.clear();
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };

  emit(clearCode);

  let prefix = indices[0];

  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    if (dict.has(key)) {
      prefix = dict.get(key)!;
    } else {
      emit(prefix);
      if (nextCode <= maxCode) {
        dict.set(key, nextCode);
        nextCode++;
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
        }
      } else {
        emit(clearCode);
        resetDict();
      }
      prefix = k;
    }
  }

  emit(prefix);
  emit(endCode);

  if (bitCount > 0) out.push(bitBuffer & 0xff);

  return out;
}

function packLZW(bytes: number[]): Uint8Array {
  const chunks: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    chunks.push(chunk.length, ...chunk);
  }
  chunks.push(0); // block terminator
  return new Uint8Array(chunks);
}

// --- Palette (4-bit per channel bucketing, top 256) -------------------------

function buildPalette(frames: GIFFrame[]): { palette: number[]; lookup: Uint8Array } {
  const histogram = new Uint32Array(4096);
  for (const frame of frames) {
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] >> 4;
      const g = d[i + 1] >> 4;
      const b = d[i + 2] >> 4;
      histogram[(r << 8) | (g << 4) | b]++;
    }
  }

  const order: number[] = Array.from({ length: 4096 }, (_, i) => i).filter((i) => histogram[i] > 0);
  order.sort((a, b) => histogram[b] - histogram[a]);

  const top = order.slice(0, 256);
  const palette: number[] = [];
  for (const bucket of top) {
    palette.push(
      ((bucket >> 8) & 0xf) * 17,
      ((bucket >> 4) & 0xf) * 17,
      (bucket & 0xf) * 17
    );
  }
  while (palette.length < 256 * 3) palette.push(0);

  // bucket -> palette index lookup (nearest of the chosen colours)
  const lookup = new Uint8Array(4096);
  for (let bucket = 0; bucket < 4096; bucket++) {
    if (histogram[bucket] === 0) {
      lookup[bucket] = 0;
      continue;
    }
    const r = ((bucket >> 8) & 0xf) * 17;
    const g = ((bucket >> 4) & 0xf) * 17;
    const b = (bucket & 0xf) * 17;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < top.length; i++) {
      const pr = palette[i * 3];
      const pg = palette[i * 3 + 1];
      const pb = palette[i * 3 + 2];
      const dr = pr - r;
      const dg = pg - g;
      const db = pb - b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    lookup[bucket] = best;
  }

  return { palette, lookup };
}

// --- Main encoder -----------------------------------------------------------

export function encodeGIF(frames: GIFFrame[], loop = 0): Uint8Array {
  if (frames.length === 0) throw new Error('No frames to encode');
  const { width, height } = frames[0];
  const { palette, lookup } = buildPalette(frames);

  const out: number[] = [];

  // Header
  out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // "GIF89a"

  // Logical Screen Descriptor (256-colour global table present)
  write16(out, width);
  write16(out, height);
  out.push(0xf7, 0x00, 0x00); // packed: GCT flag, 8-bit, sorted
  out.push(...palette); // global colour table

  // Netscape looping extension
  out.push(0x21, 0xff, 0x0b);
  out.push(...'NETSCAPE2.0'.split('').map((c) => c.charCodeAt(0)));
  out.push(0x03, 0x01);
  write16(out, loop);
  out.push(0x00);

  const indices = new Uint8Array(width * height);

  for (const frame of frames) {
    const d = frame.data;
    const delay = Math.max(1, Math.round(frame.delayMs / 10));

    // quantize
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const r = d[i] >> 4;
      const g = d[i + 1] >> 4;
      const b = d[i + 2] >> 4;
      indices[p] = lookup[(r << 8) | (g << 4) | b];
    }

    // Graphic Control Extension
    out.push(0x21, 0xf9, 0x04, 0x00);
    write16(out, delay);
    out.push(0x00, 0x00);

    // Image Descriptor
    out.push(0x2c);
    write16(out, 0);
    write16(out, 0);
    write16(out, width);
    write16(out, height);
    out.push(0x00); // no local colour table

    // LZW min code size = 8 (256 colours)
    const packed = packLZW(lzwEncode(indices, 8));
    out.push(8, ...packed);
  }

  out.push(0x3b); // trailer

  return new Uint8Array(out);
}
