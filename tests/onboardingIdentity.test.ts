import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

const { AuthManager } = await import('../src/services/authManager.ts');
const { TabbyBrain } = await import('../src/services/tabbyBrain.ts');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('fresh storage starts unauthenticated so onboarding can be shown', () => {
  const user = AuthManager.getCurrentUser();

  assert.equal(user.isLoggedIn, false);
  assert.equal(user.name, '');
});

test('name and phone are enough to continue onboarding', () => {
  const result = AuthManager.signIn('+91 98765 43210', 'Pawan');

  assert.equal(result.success, true);
  assert.equal(result.user?.name, 'Pawan');
  assert.equal(result.user?.isLoggedIn, true);
});

test('onboarding does not show a fake verification-code step', () => {
  assert.doesNotMatch(`${mainSource}\n${styleSource}`, /\botp\b|verification code|1111/i);
});

test('name questions use the trusted display name without exposing an identity', () => {
  assert.equal(
    TabbyBrain.answerPersonalQuestion('What is my name?', 'Pawan'),
    'Your name is Pawan.',
  );
  assert.equal(
    TabbyBrain.answerPersonalQuestion('Who am I?', ''),
    'Finish onboarding first so I know what to call you.',
  );
});

test('the synchronized membership state opens first-run onboarding when needed', () => {
  assert.match(mainSource, /maybeShowFirstRunOnboarding\(isJoined\)/);
});

test('fresh sessions show onboarding without waiting for the database connection', () => {
  assert.match(mainSource, /showFreshSessionOnboarding\(\);\s*connectToDatabase\(\);/);
});

test('onboarding calls the generated TypeScript reducer accessors', () => {
  assert.match(mainSource, /connection\.reducers\.joinFlat\(/);
  assert.match(mainSource, /connection\.reducers\.createAndJoinFlat\(/);
  assert.match(mainSource, /connection\.reducers\.createHomeAndJoin\(/);
  assert.doesNotMatch(mainSource, /connection\.reducers as any\)\.join_flat/);
  assert.doesNotMatch(mainSource, /connection\.reducers as any\)\.create_and_join_flat/);
});
