import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

// Execute the actual registered beforeAll, never the mutating browser test bodies.
// A network sentinel proves rejection happens before request.get, not merely eventually.
const spec = new URL('../pitch-browser/pitch.spec.js', import.meta.url);
const source = (await readFile(spec, 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(spec.href));
const base = {CI_COMPOSE_PROJECT: 'vsk-ci-guard-test', PITCH_ALLOW_MUTATIONS: '1'};

async function attempt(env, baseURL) {
  let hook;
  let calls = 0;
  const registration = () => {};
  registration.beforeAll = (fn) => {hook = fn;};
  const expect = (actual) => ({
    toBe: (expected) => assert.equal(actual, expected),
    toContain: (value) => assert.ok(actual.includes(value)),
  });
  runInNewContext(source, {test: registration, expect, execFile, promisify, fileURLToPath, URL, process});
  assert.equal(typeof hook, 'function');
  const previous = process.env;
  process.env = {PATH: previous.PATH, ...env};
  try {
    await assert.rejects(hook({baseURL, request: {get: async () => {
      calls += 1;
      throw new Error('Network sentinel: validated target reached');
    }}}));
  } finally {
    process.env = previous;
  }
  return calls;
}

test('real browser beforeAll rejects unsafe targets before any network', async () => {
  const cases = [
    [{}, 'http://127.0.0.1:5288'],
    [{CI_COMPOSE_PROJECT: base.CI_COMPOSE_PROJECT}, 'http://127.0.0.1:5288'],
    [{...base, PITCH_ALLOW_MUTATIONS: '0'}, 'http://127.0.0.1:5288'],
    [{...base, CI_COMPOSE_PROJECT: 'vsk-pitch'}, 'http://127.0.0.1:5288'],
    [base, 'http://127.0.0.1:5188'],
    [base, 'http://remote.example:5288'],
    [base, 'http://127.0.0.1:5289'],
  ];
  for (const [env, url] of cases) assert.equal(await attempt(env, url), 0, JSON.stringify({env, url}));
});

test('real browser beforeAll admits default and custom disposable URLs', async () => {
  assert.equal(await attempt(base, 'http://127.0.0.1:5288'), 1);
  assert.equal(await attempt({...base, CI_FRONTEND_PORT: '6388', CI_BACKEND_PORT: '6389'}, 'http://127.0.0.1:6388'), 1);
});
