import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commandFromInspect,
  inferCategory,
  modelDetails,
  publishedPorts,
} from '../src/core.js';

test('infers AI and website categories without matching mail as AI', () => {
  assert.equal(inferCategory({ Name: 'local_ai' }), 'ai');
  assert.equal(inferCategory({ Name: 'web-sites' }), 'website');
  assert.equal(inferCategory({ Name: 'mail-relay' }), 'other');
});

test('extracts the full model identifier after the final slash', () => {
  const details = modelDetails(
    '-hf Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M --alias Qwen-3B -c 4096 --parallel 4 --metrics',
    'llama.cpp:server'
  );
  assert.equal(details.model, 'Qwen2.5-3B-Instruct-GGUF:Q4_K_M');
  assert.deepEqual(details.launch.find(([label]) => label === 'Context per slot'), [
    'Context per slot',
    '1,024 tokens',
  ]);
});

test('reads inspect command and published ports', () => {
  assert.equal(commandFromInspect({ Config: { Cmd: ['node', 'server.mjs'] } }), 'node server.mjs');
  assert.equal(
    publishedPorts({ Ports: [{ PrivatePort: 3005, PublicPort: 3006, Type: 'tcp' }] }),
    '3006:3005/tcp'
  );
});
