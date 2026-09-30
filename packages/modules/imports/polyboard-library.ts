import { createHash } from 'node:crypto';
import type { LibraryCategory, LibraryRecord, LibraryResult } from '../../contracts/library.js';
import { decompressLibrary, libraryInputLimit, LibraryBusyError } from './library-decompress.js';
import { libraryThicknessEvidence } from './library-evidence.js';

export const libraryParserVersion = 'polyboard-library-observed/v1';
export const libraryFilenames = { PANEL: 'Panel.mat-boole', EDGE: 'Edge.mat-boole', BAR: 'Bar.mat-boole' } as const;
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
class Cursor {
  position = 0;
  constructor(readonly bytes: Buffer) {}
  take(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || this.position + size > this.bytes.length) throw new Error('Truncated binary record.');
    const b = this.bytes.subarray(this.position, this.position + size); this.position += size; return b;
  }
  expect(hex: string) { if (this.take(hex.length / 2).toString('hex') !== hex) throw new Error('Unsupported serialization layout.'); }
  u32() { return this.take(4).readUInt32LE(); }
  string() {
    const size = this.u32(); if (size > 4096) throw new Error('Text length exceeds profile limit.');
    const value = new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true }).decode(this.take(size * 2));
    if ([...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new Error('Unsupported control character in text.');
    return value;
  }
  float() { const n = this.take(8).readDoubleLE(); return Number.isFinite(n) ? String(n) : null; }
}
const uuidText = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/** Sequential observed-layout parser. Never resynchronizes by scanning for UUIDs/names. */
export function parseLibraryPayload(category: LibraryCategory, data: Buffer, sourceHash: string): Omit<LibraryResult, 'headerHex'> {
  if (data.length > 1024 * 1024) throw new Error('Expanded library exceeds limit.');
  const c = new Cursor(data); c.expect('0000000000'); const count = c.u32();
  if (count < 1 || count > 2000) throw new Error('Unsupported record count.');
  c.expect('000000000100000000000000000000000000');
  const prefix = data.subarray(0, c.position).toString('hex');
  const records: LibraryRecord[] = [], seen = new Set<string>(); let seenExtension7 = false;
  for (let i = 0; i < count; i++) {
    const offset = c.position;
    if (i > 0) c.take(4); // Opaque serialization object reference, not a material identifier.
    const name = c.string(); if (!name.length) throw new Error('Empty source name.');
    const candidateBytes = c.take(16), candidateIdHex = candidateBytes.toString('hex');
    if (candidateBytes[6] >> 4 !== 4 || candidateBytes[8] >> 6 !== 2 || seen.has(candidateIdHex)) throw new Error('Unsupported or duplicate source identifier.');
    seen.add(candidateIdHex); const candidateUuid = uuidText(candidateIdHex), group = c.string();
    if (i === 0) c.expect('0002000000010000000001000000000000000000000000');
    else { c.take(4); c.expect('00000000'); }
    c.take(13); // Packed appearance fields, deliberately unnamed.
    const textures: LibraryRecord['textures'] = [];
    const pathOffset = c.position, path = c.string(); if (path) textures.push({ reference: path, offset: pathOffset, role: 'UNKNOWN' });
    c.take(40);
    if (i === 0) c.expect('00000000000000000000');
    const extensions = c.u32(); c.expect('00000000');
    if (extensions > 3 || (category !== 'PANEL' && extensions !== 0)) throw new Error('Unsupported extension count.');
    if (category === 'PANEL') {
      if (i === 0) c.expect('0000000000');
      for (let e = 0; e < extensions; e++) {
        const tag = c.take(4).toString('hex'); c.take(4);
        if (i === 0 && e === 0) c.expect('0002000000');
        const type = c.u32();
        if (tag === '73697600' && type === 4) c.take(1);
        else if (tag === '74736f63' && type === 5) c.take(8);
        else if (tag === '65636166' && type === 7) {
          if (!seenExtension7) { c.expect('0000000000'); seenExtension7 = true; }
          const size = c.u32(); if (size < 102 || size > 8294) throw new Error('Unsupported nested extension size.');
          const start = c.position, nested = new Cursor(c.take(size));
          const discriminator = nested.bytes[10]; if (discriminator !== 0 && discriminator !== 1) throw new Error('Unsupported nested appearance layout.');
          nested.take(discriminator === 1 ? 47 : 48); const at = nested.position, ref = nested.string();
          nested.take(discriminator === 1 ? 51 : 50);
          if (nested.position !== size) throw new Error('Nested extension length mismatch.');
          if (ref) textures.push({ reference: ref, offset: start + at, role: 'UNKNOWN' });
        } else throw new Error('Unsupported extension tag/type.');
      }
    }
    let thicknessCandidate: string | null = null;
    if (category === 'PANEL') { thicknessCandidate = c.float(); c.take(1); c.take(8); }
    else if (category === 'EDGE') { thicknessCandidate = c.float(); c.take(8); }
    else {
      if (i === 0) c.expect('0000000000');
      c.take(4); c.take(16); // Profile numbers remain raw, without dimension semantics.
      c.take(4); if (i === 0) c.expect('0002000000'); c.take(16);
    }
    const corroborated = libraryThicknessEvidence[sourceHash]?.[candidateUuid];
    if (corroborated !== undefined && corroborated !== thicknessCandidate) throw new Error('Corroborated thickness integrity mismatch.');
    const ownHash = createHash('sha256').update(`${libraryParserVersion}:${sourceHash}:${i}`).digest('hex');
    const ownId = uuidText(`${ownHash.slice(0, 12)}8${ownHash.slice(13, 16)}a${ownHash.slice(17, 32)}`);
    records.push({ id: ownId, index: i + 1, offset, endOffset: c.position, category, name, group, candidateUuid, candidateIdHex,
      thicknessCandidate, thickness: corroborated === undefined ? null : { value: corroborated, unit: 'mm', confidence: 'CORROBORATED', evidence: 'POLYBOARD_LIBRARY_ANALYSIS/2026-09-30; exact snapshot hash + source UUID; real cutting CSV comparison' },
      textures, rawHex: data.subarray(offset, c.position).toString('hex'),
      unmapped: ['Serialization and appearance blocks', 'Flags / grain / orientation', 'Financial-looking values', 'Manufacturer / family semantics', ...(category === 'BAR' ? ['All profile properties / dimensions'] : ['Uncorroborated thickness semantics']), 'Texture roles / scale; no stock dimensions inferred'] });
  }
  if (c.position !== data.length) throw new Error('Trailing data or record count mismatch.');
  return { status: 'NEEDS_REVIEW', storedCount: count, recordCount: count, decodedHash: sha256(data), payloadPrefixHex: prefix,
    findings: ['Read-only review staging; not production-authoritative.', 'Source UUID stability across snapshots is unproven. Undocumented bytes remain raw.'], records };
}

export async function parseLibrary(category: LibraryCategory, bytes: Buffer): Promise<LibraryResult> {
  let headerHex = '';
  try {
    if (!bytes.length || bytes.length > libraryInputLimit) throw new Error('Library must be nonempty and at most 256 KiB.');
    const signature = Buffer.from(`bo:materials:${category.toLowerCase()}`), start = signature.length + 12;
    if (bytes.length < start + 4 || !bytes.subarray(0, signature.length).equals(signature)) throw new Error('Library signature does not match the selected category.');
    headerHex = bytes.subarray(0, start).toString('hex');
    if (bytes.readUInt32LE(start - 8) !== 4 || bytes.readUInt32LE(start - 4) !== bytes.length - start || bytes.subarray(start, start + 4).toString() !== 'BZh9') throw new Error('Unsupported container version or compressed length.');
    return { ...parseLibraryPayload(category, await decompressLibrary(bytes.subarray(start)), sha256(bytes)), headerHex };
  } catch (error) {
    if (error instanceof LibraryBusyError) throw error;
    return { status: 'FAILED', storedCount: null, recordCount: 0, decodedHash: null, headerHex, payloadPrefixHex: '', records: [], findings: [(error as Error).message] };
  }
}
