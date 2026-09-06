import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const forwardedArgs = process.argv.slice(2);
const viteArgs = forwardedArgs.length === 1 && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(forwardedArgs[0])
  ? ['--host', forwardedArgs[0]]
  : forwardedArgs;
const children = new Set();
let stopping = false;
const lifecycle = setInterval(() => {}, 2 ** 30);

function start(label, entrypoint, args, cwd = process.cwd()) {
  const child = spawn(process.execPath, [entrypoint, ...args], {
    cwd,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.once('error', error => {
    if (stopping && error.code === 'EPERM') return;
    console.error(`[${label}] failed to start:`, error.message);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[${label}] stopped unexpectedly${signal ? ` (${signal})` : ` with code ${code ?? 1}`}.`);
      stop(code ?? 1);
    }
  });
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(lifecycle);
  for (const child of children) {
    try { child.kill('SIGTERM'); }
    catch (error) {
      if (error?.code !== 'ESRCH' && error?.code !== 'EPERM') throw error;
    }
  }
  process.exitCode = exitCode;
  const timer = setTimeout(() => process.exit(exitCode), 2_000);
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

async function main() {
  console.log('Starting Tabby web app with same-origin Instamart API routes...');
  if (!stopping) start('tabby', resolve('node_modules/vite/bin/vite.js'), viteArgs);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
});
