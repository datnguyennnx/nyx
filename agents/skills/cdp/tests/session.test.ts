/**
 * session.test.ts — Unit tests for the Session class
 *
 * Session wraps CDP-over-WebSocket communication. These tests validate
 * the class structure, invariants, and error handling WITHOUT requiring
 * a real CDP endpoint. WebSocket is mocked/stubbed where needed.
 *
 * Key coverage:
 *  - Constructor and structural invariants
 *  - Connection guard: isConnected() reflecting state
 *  - MAX_PENDING limit
 *  - _call rejection when not connected
 *  - _call timeout behavior (mock WebSocket)
 *  - activeSessionId lifecycle
 */

import { test, expect } from 'bun:test';
import { Session } from '../sdk/session.ts';

// ─── Constructor & Structural Invariants ─────────────────────────────────

test('constructor does not throw', () => {
  expect(() => new Session()).not.toThrow();
});

test('isConnected() returns false for a fresh instance', () => {
  const s = new Session();
  expect(s.isConnected()).toBe(false);
});

test('MAX_PENDING static constant exists and is 1000', () => {
  expect(Session.MAX_PENDING).toBeDefined();
  expect(typeof Session.MAX_PENDING).toBe('number');
  expect(Session.MAX_PENDING).toBe(1000);
});

test('activeSessionId starts as undefined', () => {
  const s = new Session();
  // activeSessionId is private; access via bracket or property access
  expect((s as any).activeSessionId).toBeUndefined();
});

test('Session exposes domains getter', () => {
  const s = new Session();
  expect(s.domains).toBeDefined();
  expect(typeof s.domains).toBe('object');
});

// ─── Connection Guard ─────────────────────────────────────────────────────

test('isConnected() returns false after close()', () => {
  const s = new Session();
  // close on a never-connected session should not throw
  expect(() => s.close()).not.toThrow();
  expect(s.isConnected()).toBe(false);
});

// ─── _call behavior ──────────────────────────────────────────────────────

test('_call rejects with "Not connected" when ws is undefined', async () => {
  const s = new Session();
  await expect(s._call('TestMethod', {})).rejects.toThrow('Not connected');
});

test('_call rejects with "Not connected" when ws exists but is not OPEN', async () => {
  const s = new Session();
  // Set ws to a connecting (not open) state
  (s as any).ws = { readyState: 0 }; // WebSocket.CONNECTING = 0
  await expect(s._call('TestMethod', {})).rejects.toThrow('Not connected');
});

test('_call with timeoutMs=1 rejects when no response arrives', async () => {
  const s = new Session();
  // Stub ws as connected so _call proceeds past the guard
  (s as any).ws = {
    readyState: 1, // WebSocket.OPEN = 1
    send: () => {}, // swallow sends — no CDP response will come
  };
  await expect(s._call('Test.method', {}, 1)).rejects.toThrow(
    'CDP command timed out after 1ms: Test.method',
  );
});

test('_call cleans up pending map after timeout', async () => {
  const s = new Session();
  (s as any).ws = {
    readyState: 1,
    send: () => {},
  };
  const pendingBefore = (s as any).pending.size;
  try {
    await s._call('Test.method', {}, 1);
  } catch {
    // expected
  }
  // After rejection, the pending entry should be cleaned up
  expect((s as any).pending.size).toBe(pendingBefore);
});

test('_call rejects with "Too many pending CDP commands" when pending is full', async () => {
  const s = new Session();
  (s as any).ws = {
    readyState: 1,
    send: () => {},
  };
  // Fill the pending map to MAX_PENDING
  const map: Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }> = (s as any).pending;
  for (let i = 0; i < Session.MAX_PENDING; i++) {
    map.set(i, { resolve: () => {}, reject: () => {} });
  }
  (s as any).nextId = Session.MAX_PENDING + 1;
  await expect(s._call('TestMethod', {})).rejects.toThrow('Too many pending CDP commands');
});

// ─── setActiveSession / getActiveSession ──────────────────────────────────

test('setActiveSession and getActiveSession round-trip', () => {
  const s = new Session();
  expect(s.getActiveSession()).toBeUndefined();
  s.setActiveSession('test-session-id');
  expect(s.getActiveSession()).toBe('test-session-id');
  s.setActiveSession(undefined);
  expect(s.getActiveSession()).toBeUndefined();
});

// ─── waitFor ──────────────────────────────────────────────────────────────

test('waitFor rejects on timeout when no event arrives', async () => {
  const s = new Session();
  // waitFor internally calls _call via this.use if targetId is provided,
  // so avoid targetId. With no events arriving, the timeout should fire.
  await expect(s.waitFor('Test.event', undefined, 10)).rejects.toThrow(
    'Timeout waiting for Test.event',
  );
});
