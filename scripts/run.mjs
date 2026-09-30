import { spawn } from 'node:child_process';
const mode = process.argv[2];
const children = [
  spawn(process.execPath, mode === 'dev' ? ['--import', 'tsx', 'apps/api/main.ts'] : ['dist/apps/api/main.js'], { stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, 'apps/web', '--hostname', '127.0.0.1', ...(mode === 'dev' ? ['--webpack'] : [])], { stdio: 'inherit', windowsHide: true })
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); setTimeout(() => process.exit(code), 1500); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
for (const child of children) child.on('exit', code => stop(code ?? 1));
