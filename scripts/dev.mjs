import { spawn } from 'node:child_process';
import { request } from 'node:http';
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

function bridgeIsHealthy() {
  return new Promise(resolveHealth => {
    const health = request('http://127.0.0.1:8787/health', { method: 'GET', timeout: 500 }, response => {
      response.resume();
      resolveHealth(response.statusCode === 200);
    });
    health.once('timeout', () => { health.destroy(); resolveHealth(false); });
    health.once('error', () => resolveHealth(false));
    health.end();
  });
}

async function waitForBridge(timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    if (await bridgeIsHealthy()) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
  }
  throw new Error('Instamart developer agent did not become ready on port 8787.');
}

async function main() {
  console.log('Starting Tabby web app and Instamart developer agent...');
  if (await bridgeIsHealthy()) {
    console.log('Using the Instamart developer agent already running on port 8787.');
  } else {
    start('instamart', resolve('node_modules/tsx/dist/cli.mjs'), ['src/httpServer.ts'], resolve('instamart-mcp'));
    await waitForBridge();
    console.log('Instamart developer agent is ready.');
  }
  if (!stopping) start('tabby', resolve('node_modules/vite/bin/vite.js'), viteArgs);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
});
