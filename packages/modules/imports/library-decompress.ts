import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const libraryInputLimit = 256 * 1024;
export const libraryOutputLimit = 1024 * 1024;
let active = 0;
export class LibraryBusyError extends Error {}
/** No imported code/paths run. Only the installed decoder runs, with no application environment. */
export async function decompressLibrary(input: Buffer): Promise<Buffer> {
  if (active >= 2) throw new LibraryBusyError('Library parser is busy. Retry shortly.');
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        try {
          const decoder = require(workerData.decoder);
          const input = Buffer.from(workerData.input);
          const output = Buffer.alloc(workerData.limit);
          let read = 0, written = 0;
          // Deliberately omit eof(): decoder must consume the end marker and verify stream CRC.
          const stream = new decoder.Stream();
          stream.readByte = () => { if (read >= input.length) throw Error('Truncated BZip2'); return input[read++]; };
          decoder.decode(stream,
            { writeByte(byte) { if (written >= output.length) throw Error('Expansion limit'); output[written++] = byte; } }, false);
          if (read !== input.length) throw Error('Trailing BZip2 data');
          parentPort.postMessage({ bytes: output.subarray(0, written) });
        } catch { parentPort.postMessage({ error: 'Invalid, unsupported or oversized BZip2 stream.' }); }
      `, { eval: true, workerData: { input, limit: libraryOutputLimit, decoder: require.resolve('seek-bzip') }, env: {}, resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 4 } });
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Library decompression timed out.')); }, 5000);
      worker.once('message', (message: { error?: string; bytes?: Uint8Array }) => {
        clearTimeout(timer); void worker.terminate();
        if (message.bytes) resolve(Buffer.from(message.bytes)); else reject(new Error(message.error));
      });
      worker.once('error', () => { clearTimeout(timer); reject(new Error('Library decoder failed safely.')); });
      worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Library decoder stopped.')); });
    });
  } finally { active--; }
}
