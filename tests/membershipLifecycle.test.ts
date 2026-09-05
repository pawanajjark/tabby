import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(new URL('../spacetimedb/src/index.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

function exportedBlock(name: string): string {
  const start = moduleSource.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextExport = moduleSource.indexOf('\nexport const ', start + 1);
  return moduleSource.slice(start, nextExport === -1 ? undefined : nextExport);
}

test('connecting does not make someone a household member', () => {
  assert.doesNotMatch(exportedBlock('on_connect'), /ctx\.db\.member\.(?:insert|identity\.update)/);
});

test('anonymous startup does not create a database conversation', () => {
  const start = clientSource.indexOf('function ensureConversation()');
  const end = clientSource.indexOf('\nfunction renderConversation()', start);
  assert.notEqual(start, -1, 'missing ensureConversation');
  assert.notEqual(end, -1, 'missing renderConversation boundary');
  const block = clientSource.slice(start, end);

  assert.match(block, /if \(!currentIdentityHasMembership\(\)\) \{[\s\S]*?return;/);
  assert.match(block, /connection\.reducers\.createConversation/);
});

test('anonymous local chat never invokes conversation reducers', () => {
  const persistStart = clientSource.indexOf('function persistConversationMessage(');
  const persistEnd = clientSource.indexOf('\nfunction addMessage(', persistStart);
  const createStart = clientSource.indexOf('function createNewConversation()');
  const createEnd = clientSource.indexOf("\ndocument.querySelector('#new-conversation')", createStart);
  const persistBlock = clientSource.slice(persistStart, persistEnd);
  const createBlock = clientSource.slice(createStart, createEnd);

  assert.match(persistBlock, /!currentIdentityHasMembership\(\)/);
  assert.match(createBlock, /if \(currentIdentityHasMembership\(\)\)/);
});

test('changing a display name cannot create a membership', () => {
  assert.doesNotMatch(exportedBlock('set_display_name'), /ctx\.db\.member\.insert/);
});

test('explicit flat onboarding can create a membership', () => {
  assert.match(exportedBlock('join_flat'), /ctx\.db\.member\.insert/);
});

test('creating a home and joining it is one atomic membership transaction', () => {
  const block = exportedBlock('create_home_and_join');
  assert.match(block, /ctx\.db\.residence\.insert/);
  assert.match(block, /ctx\.db\.flat\.insert/);
  assert.match(block, /ctx\.db\.member\.insert/);
});

test('conversation message retries are idempotent across tabs', () => {
  const block = exportedBlock('append_conversation_message_once');
  assert.match(block, /message_key/);
  assert.match(block, /appendConversationMessage\(ctx, args, messageKey\)/);
  const helperStart = moduleSource.indexOf('function appendConversationMessage(');
  const helperEnd = moduleSource.indexOf('\nconst conversationMessageArgs', helperStart);
  const helper = moduleSource.slice(helperStart, helperEnd);
  assert.match(helper, /conversationMessageReceipt\.idempotency_key\.find/);
  assert.match(helper, /conversationMessageReceipt\.insert/);
  assert.ok(helper.indexOf('idempotency_key.find') < helper.indexOf('conversationMessage.insert'));
  const routeStart = clientSource.indexOf('async function routeAcknowledgedCommandOnce(');
  const routeEnd = clientSource.indexOf('\nfunction addMessage(', routeStart);
  const routeBlock = clientSource.slice(routeStart, routeEnd);
  assert.match(routeBlock, /navigator\.locks\.request/);
  assert.match(routeBlock, /reply:\$\{command\.id\}/);
});

test('acknowledged messages route even when database sync replaced the temporary local id', () => {
  const flushStart = clientSource.indexOf('async function flushActiveOutbox()');
  const flushEnd = clientSource.indexOf('\nasync function routeAcknowledgedCommandOnce(', flushStart);
  assert.notEqual(flushStart, -1);
  assert.notEqual(flushEnd, -1);
  const flushBlock = clientSource.slice(flushStart, flushEnd);

  assert.match(flushBlock, /if \(message\) updateMessage/);
  assert.doesNotMatch(flushBlock, /if \(!message\) continue/);
  assert.match(flushBlock, /routeAcknowledgedCommandOnce\(command, payload\)/);
});
