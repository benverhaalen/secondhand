import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Parse the scalar tables used by this config without installing a TOML dependency.
function table(name: string): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  let section = '';
  for (const raw of read('fly.toml').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line.startsWith('[')) { section = line.replace(/^\[+|\]+$/g, ''); continue; }
    if (section !== name || !line) continue;
    const entry = /^(\w+)\s*=\s*("[^"\n]*"|true|false|\d+)$/.exec(line);
    assert.ok(entry, `unsupported Fly config entry: ${line}`);
    assert.ok(!(entry[1] in values), `duplicate ${name}.${entry[1]}`);
    values[entry[1]] = JSON.parse(entry[2]) as string | number | boolean;
  }
  return values;
}

test('Fly keeps the in-process watcher on one always-on machine', () => {
  const service = table('http_service');
  assert.equal(service.auto_stop_machines, 'off', 'stopping an idle machine stops the watcher');
  assert.equal(service.auto_start_machines, false);
  assert.equal(service.min_machines_running, 1, 'the watcher needs a running machine');
  assert.match(read('fly.toml'), /#.*fly scale count 1/);
});

test('Fly volume and store use the same persistent directory', () => {
  assert.equal(table('mounts').destination, '/data');
  assert.equal(table('mounts').destination, table('env').SECONDHAND_DATA_DIR);
  assert.equal(table('mounts').source, 'secondhand_data');
  assert.equal(table('mounts').initial_size, '1gb');
});

test('Fly forwards HTTPS to the server port and supplies the trusted peer header', () => {
  assert.equal(table('http_service').internal_port, 8080);
  assert.equal(table('env').PORT, '8080');
  assert.equal(table('http_service').force_https, true);
  assert.equal(table('env').SECONDHAND_PEER_HEADER, 'Fly-Client-IP');
  assert.equal(table('env').NODE_ENV, 'production');
  for (const [name, value] of Object.entries(table('env'))) {
    assert.equal(typeof value, 'string', `${name} must be a string`);
    assert.ok(!name.startsWith('FLY_'), `${name} is reserved`);
  }
});

test('Fly probes the GET health endpoint that the entry answers', () => {
  assert.deepEqual(table('http_service.checks'), {
    grace_period: '10s', interval: '30s', method: 'GET', timeout: '5s', path: '/healthz',
  });
  assert.match(read('server/main.ts'), /=== '\/healthz'\) response = request\.method === 'GET'\s*\? Response\.json\(\{ ok: true \}\)/);
});

test('Fly allows SIGTERM to drain within 30 seconds', () => {
  assert.equal(table('').kill_signal, 'SIGTERM');
  assert.equal(table('').kill_timeout, 30);
});

test('Fly uses the decided app placeholder, region and VM size', () => {
  assert.equal(table('').app, 'secondhand-api');
  assert.equal(table('').primary_region, 'ord');
  assert.equal(table('vm').size, 'shared-cpu-1x');
  assert.equal(table('vm').memory, '512mb');
});

test('Fly config contains secret names only, never assigned keys or tokens', () => {
  assert.doesNotMatch(read('fly.toml'), /^\s*[\w-]*(?:KEY|TOKEN|SECRET)[\w-]*\s*=/mi);
  for (const name of ['DECISION_SIGNING_KEY', 'SECONDHAND_VISITOR_KEY', 'SECONDHAND_VAULT_KEY']) {
    assert.match(read('fly.toml'), new RegExp(`#.*\\b${name}\\b`));
  }
});

test('Docker pins the sqlite-compatible Node patch and runs the entry directly', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /^FROM node:24\.10\.0-bookworm-slim\s*$/m);
  assert.match(docker, /^WORKDIR \/srv\/secondhand\s*$/m);
  assert.match(docker, /^CMD \["node", "server\/main\.ts"\]\s*$/m);
  assert.match(docker, /^ENV NODE_ENV=production\s*$/m);
  assert.match(docker, /^EXPOSE 8080\s*$/m);
});

test('Docker installs locked production dependencies before copying source', () => {
  const docker = read('Dockerfile');
  const install = docker.indexOf('npm ci --omit=dev --ignore-scripts');
  assert.match(docker, /^COPY app\/package\.json app\/package-lock\.json \.\/app\/$/m);
  assert.ok(install > docker.indexOf('COPY app/package.json'));
  assert.ok(docker.indexOf('COPY . .') > install, 'source changes should reuse the dependency layer');
});

test('Docker runs as node and prepares writable data storage', () => {
  const docker = read('Dockerfile');
  assert.deepEqual([...docker.matchAll(/^USER\s+(.+)$/gm)].map(match => match[1].trim()), ['node']);
  assert.match(docker, /mkdir -p \/data/);
  assert.match(docker, /chown node:node \/data/);
});

test('Docker context excludes private env files, databases, Git and dependencies', () => {
  const patterns = read('.dockerignore').split('\n').map(line => line.trim());
  assert.equal(patterns.find(line => line && !line.startsWith('#')), '**', 'context starts closed');
  for (const pattern of ['**/.env*', '**/*.db', '**/.git', '**/node_modules', '**/store.json']) {
    assert.ok(patterns.includes(pattern), `missing context exclusion: ${pattern}`);
    assert.ok(patterns.lastIndexOf(pattern) > patterns.findLastIndex(line => line.startsWith('!')),
      `${pattern} must override allowed source directories`);
  }
  for (const pattern of ['!server/**', '!app/src/**', '!app/package.json', '!app/package-lock.json', '!log/**', '!spec/sites.mjs', '!spec/examples/**']) {
    assert.ok(patterns.includes(pattern), `runtime input omitted: ${pattern}`);
  }
});
