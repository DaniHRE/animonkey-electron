import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reduceActionToastQueue } from '../src/lib/action-toast-queue.mts';

function enqueue(state, id) {
  return reduceActionToastQueue(state, {
    type: 'enqueue',
    toast: { id },
  });
}

function emptyState() {
  return { visible: [], queued: [] };
}

test('keeps the newest three toasts visible and queues the rest', () => {
  let state = emptyState();
  for (const id of ['one', 'two', 'three', 'four', 'five'])
    state = enqueue(state, id);

  assert.deepEqual(
    state.visible.map((toast) => toast.id),
    ['three', 'two', 'one'],
  );
  assert.deepEqual(
    state.queued.map((toast) => toast.id),
    ['four', 'five'],
  );
});

test('promotes queued toasts in arrival order above older visible toasts', () => {
  let state = emptyState();
  for (const id of ['one', 'two', 'three', 'four', 'five'])
    state = enqueue(state, id);

  state = reduceActionToastQueue(state, { type: 'dismiss', id: 'two' });

  assert.deepEqual(
    state.visible.map((toast) => toast.id),
    ['four', 'three', 'one'],
  );
  assert.deepEqual(
    state.queued.map((toast) => toast.id),
    ['five'],
  );

  state = reduceActionToastQueue(state, { type: 'dismiss', id: 'one' });

  assert.deepEqual(
    state.visible.map((toast) => toast.id),
    ['five', 'four', 'three'],
  );
  assert.deepEqual(state.queued, []);
});

test('re-enqueuing an existing toast id does not duplicate it', () => {
  let state = emptyState();
  for (const id of ['one', 'two', 'three', 'four']) state = enqueue(state, id);

  state = enqueue(state, 'two');

  assert.deepEqual(
    state.visible.map((toast) => toast.id),
    ['two', 'three', 'one'],
  );
  assert.deepEqual(
    state.queued.map((toast) => toast.id),
    ['four'],
  );
});

test('dismissing an unknown toast leaves the queue unchanged', () => {
  const state = enqueue(emptyState(), 'one');

  assert.equal(
    reduceActionToastQueue(state, { type: 'dismiss', id: 'missing' }),
    state,
  );
});
