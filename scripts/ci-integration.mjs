import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {accessSync, appendFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = JSON.parse(readFileSync(new URL('../.github/ci-integration.json', import.meta.url), 'utf8'));
const scripts = new Set();
for (const entries of Object.values(suites)) {
  assert(entries.length > 0, 'CI groups must not be empty');
  for (const {script, env = {}} of entries) {
    assert(/^tests\/(ui|network)\/[\w-]+\.integration\.mjs$/.test(script), `Invalid CI script: ${script}`);
    assert(!scripts.has(script), `Duplicate CI script: ${script}`);
    assert(Object.values(env).every(value => typeof value === 'string'), `Invalid environment for ${script}`);
    accessSync(new URL(`../${script}`, import.meta.url));
    scripts.add(script);
  }
}

const [group, ...extra] = process.argv.slice(2);
assert(extra.length === 0, 'Usage: node scripts/ci-integration.mjs <group|--list>');
if (group === '--list') {
  console.log(JSON.stringify(suites, null, 2));
} else {
  assert(Object.hasOwn(suites, group), `Choose a CI group: ${Object.keys(suites).join(', ')}`);
  const summary = text => {
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  };
  summary(`## Integration tests: ${group}\n\n| Script | Result | Seconds |\n| --- | --- | ---: |\n`);
  for (const {script, env = {}} of suites[group]) {
    console.log(process.env.GITHUB_ACTIONS === 'true' ? `::group::${script}` : `Running ${script}`);
    const started = performance.now();
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {...process.env, ...env},
      stdio: 'inherit',
    });
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const passed = result.status === 0 && !result.error;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${script} (${seconds}s)`);
    if (process.env.GITHUB_ACTIONS === 'true') console.log('::endgroup::');
    summary(`| ${script} | ${passed ? 'PASS' : 'FAIL'} | ${seconds} |\n`);
    if (!passed) {
      console.error(result.error || `Script exited with ${result.signal || result.status}`);
      summary('\nRemaining scripts in this group were not run.\n');
      process.exitCode = result.status || 1;
      break;
    }
  }
}
