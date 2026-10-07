import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {closeSync, openSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const [script, ...args] = process.argv.slice(2);
assert(/^tests\/(ui|network)\/[\w-]+\.integration\.mjs$/.test(script), 'Expected an integration script');
await mkdir(path.join(root, '.wrangler'), {recursive: true});
const directory = await mkdtemp(path.join(root, '.wrangler/isolated-test-'));
const children = [];
const logs = [];
const reservations = [];
let stopping;

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  reservations.push(server);
  return server.address().port;
}

function start(command, env, logName) {
  const log = logName && path.join(directory, logName);
  if (log) logs.push(log);
  const fd = log ? openSync(log, 'w') : undefined;
  const child = spawn(process.execPath, command, {
    cwd: root, env: {...process.env, ...env}, detached: true,
    stdio: log ? ['ignore', fd, fd] : 'inherit',
  });
  if (fd !== undefined) closeSync(fd);
  const entry = {child, settled: false};
  entry.done = new Promise(resolve => {
    child.once('error', error => { entry.settled = true; resolve({error}); });
    child.once('exit', (code, signal) => { entry.settled = true; resolve({code, signal}); });
  });
  children.push(entry);
  return entry;
}

async function ready(url, service) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    assert(!service.settled, `Service exited before readiness: ${url}`);
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1000)});
      await response.body?.cancel();
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Service readiness timed out: ${url}`);
}

function stop() {
  return stopping ||= (async () => {
    for (const server of reservations) if (server.listening) await new Promise(resolve => server.close(resolve));
    // Each process has its own group, including Wrangler/Vite subprocesses.
    const signal = value => { for (const {child} of children) if (child.pid) {
      try { process.kill(-child.pid, value); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    } };
    signal('SIGTERM');
    await Promise.race([Promise.all(children.map(entry => entry.done)), delay(2000)]);
    signal('SIGKILL');
    await rm(directory, {recursive: true, force: true});
  })();
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => { void stop().finally(() => process.exit(code)); });
}

try {
  const port = await reservePort();
  const frontPort = await reservePort();
  const inspectorPort = await reservePort();
  const api = `http://127.0.0.1:${port}`;
  const base = `http://127.0.0.1:${frontPort}`;
  const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  delete config.account_id;
  config.main = path.join(root, 'worker/index.ts');
  config.assets.directory = path.join(root, 'dist');
  config.vars = {...config.vars, ALLOWED_ORIGINS: base};
  const configPath = path.join(directory, 'wrangler.json');
  await writeFile(configPath, JSON.stringify(config));
  for (const server of reservations) await new Promise(resolve => server.close(resolve));
  const worker = start(['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--config', configPath,
    '--port', String(port), '--inspector-port', String(inspectorPort), '--persist-to', path.join(directory, 'state')], {}, 'worker.log');
  const vite = start(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontPort), '--strictPort'],
    {MOCHA_DEV_API: api, VITE_API_BASE: ''}, 'vite.log');
  await ready(`${api}/api/health`, worker);
  await ready(base, vite);
  await ready(`${base}/api/health`, vite);
  console.log(`Isolated services: ${base} → ${api}`);
  const result = await start([script, ...args], {BASE_URL: base, TEST_FRONTEND: base, TEST_API_BASE: api}).done;
  if (result.error || result.code !== 0) {
    process.exitCode = result.code || 1;
    throw result.error || new Error(`Integration script exited with ${result.signal || result.code}`);
  }
} catch (error) {
  process.exitCode ||= 1;
  console.error(error);
  for (const log of logs) console.error(`${path.basename(log)}:\n${(await readFile(log, 'utf8')).split('\n').slice(-100).join('\n')}`);
} finally {
  await stop();
}
