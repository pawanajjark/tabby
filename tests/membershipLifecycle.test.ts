import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(new URL('../spacetimedb/src/index.ts', import.meta.url), 'utf8');

function exportedBlock(name: string): string {
  const start = moduleSource.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextExport = moduleSource.indexOf('\nexport const ', start + 1);
  return moduleSource.slice(start, nextExport === -1 ? undefined : nextExport);
}

test('connecting does not make someone a household member', () => {
  assert.doesNotMatch(exportedBlock('on_connect'), /ctx\.db\.member\.(?:insert|identity\.update)/);
});

test('changing a display name cannot create a membership', () => {
  assert.doesNotMatch(exportedBlock('set_display_name'), /ctx\.db\.member\.insert/);
});

test('explicit flat onboarding can create a membership', () => {
  assert.match(exportedBlock('join_flat'), /ctx\.db\.member\.insert/);
});
