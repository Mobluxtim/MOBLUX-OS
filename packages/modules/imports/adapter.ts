export interface ImportSource { name: string; hash: string; size: number; }
export interface ImportAssessment { adapter: string; status: 'PENDING_MAPPING'; findings: string[]; }
export interface ImportAdapter { id: string; assess(source: ImportSource): ImportAssessment; }
// No vendor fields are parsed until real exports establish a verified adapter profile.
export const unmappedAdapter: ImportAdapter = { id: 'unmapped-source/v1', assess: () => ({ adapter: 'unmapped-source/v1', status: 'PENDING_MAPPING', findings: ['Source preserved unchanged. No verified PolyBoard mapping is available.', 'No dimensions, materials or machining data have been extracted. Not validated for manufacturing.'] }) };
export const maxUploadBytes = 20 * 1024 * 1024;
export function validSource(name: string, bytes: Buffer) {
  // Reject control characters in names, not valid source content.
  // eslint-disable-next-line no-control-regex
  if (!/^[^/\\\x00-\x1f]{1,180}\.(csv|txt|dxf|3ds|pdf)$/i.test(name)) return 'Use a CSV, TXT, DXF, 3DS or PDF filename without paths (maximum 180 characters before extension).';
  if (!bytes.length || bytes.length > maxUploadBytes) return 'Choose a non-empty file no larger than 20 MB.';
  if (bytes.subarray(0, 2).toString() === 'MZ' || bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return 'Executable content is not accepted.';
  return null;
}
