'use strict';

// Unit tests — fetch is injected, nothing touches the network.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  Client,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} = require('..');

function fakeResponse(status = 200, payload = { success: 1, data: [] }, headers = {}) {
  return {
    status,
    headers: new Headers(headers),
    json: async () => {
      if (payload === null) throw new SyntaxError('no body');
      return payload;
    },
  };
}

function makeClient(responses, options = {}) {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url, init });
    return responses.shift();
  };
  const client = new Client('fb_live_test', { fetch: fetchMock, maxRetries: 0, ...options });
  return { client, calls };
}

test('sends bearer key and drops undefined params', async () => {
  const { client, calls } = makeClient([fakeResponse()]);
  await client.fixtures({ league: 39, status: undefined });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer fb_live_test');
  assert.ok(calls[0].url.endsWith('/fixtures?league=39'));
});

test('serializes Date, boolean and array params', async () => {
  const { client, calls } = makeClient([fakeResponse()]);
  const kickoff = new Date('2026-08-19T12:00:00Z');
  await client.fixtures({ startTime: kickoff, esports: false, include: ['odds', 'stats'] });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('start_time'), String(Math.floor(kickoff.getTime() / 1000)));
  assert.equal(url.searchParams.get('esports'), 'false');
  assert.equal(url.searchParams.get('include'), 'odds,stats');
});

test('paginated response returns data plus pagination', async () => {
  const { client } = makeClient([fakeResponse(200, {
    success: 1,
    data: [{ id: 1 }, { id: 2 }],
    pagination: { page: 1, per_page: 50, count: 2, has_more: true },
  })]);
  const { data, pagination } = await client.fixtures();
  assert.equal(data.length, 2);
  assert.equal(pagination.page, 1);
  assert.equal(pagination.has_more, true);
});

test('iterAll walks pages', async () => {
  const { client } = makeClient([
    fakeResponse(200, { success: 1, data: [{ id: 1 }], pagination: { page: 1, has_more: true } }),
    fakeResponse(200, { success: 1, data: [{ id: 2 }], pagination: { page: 2, has_more: false } }),
  ]);
  const ids = [];
  for await (const row of client.iterAll((p) => client.fixtures(p))) ids.push(row.id);
  assert.deepEqual(ids, [1, 2]);
});

test('error envelope maps to typed exception', async () => {
  const { client } = makeClient([fakeResponse(400, {
    success: 0,
    error: {
      type: 'invalid_request',
      code: 'invalid_time',
      message: 'start_time must be a unix timestamp in seconds (UTC).',
      param: 'start_time',
      request_id: 'req_123',
    },
  })]);
  await assert.rejects(client.fixtures({ startTime: -1 }), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, 'invalid_time');
    assert.equal(err.requestId, 'req_123');
    return true;
  });
});

test('401 raises AuthenticationError', async () => {
  const { client } = makeClient([fakeResponse(401, { success: 0, error: { message: 'bad key' } })]);
  await assert.rejects(client.status(), AuthenticationError);
});

test('404 raises NotFoundError', async () => {
  const { client } = makeClient([fakeResponse(404, { success: 0, error: { message: 'no fixture' } })]);
  await assert.rejects(client.fixture(999999999), NotFoundError);
});

test('retries 429 then succeeds', async () => {
  const { client, calls } = makeClient([
    fakeResponse(429, { success: 0, error: { message: 'slow down' } }, { 'Retry-After': '0' }),
    fakeResponse(200, { success: 1, data: [{ id: 7 }] }),
  ], { maxRetries: 2 });
  const { data } = await client.fixtures();
  assert.equal(data[0].id, 7);
  assert.equal(calls.length, 2);
});

test('429 without retries raises RateLimitError with retryAfter', async () => {
  const { client } = makeClient([
    fakeResponse(429, { success: 0, error: { message: 'slow down' } }, { 'Retry-After': '9' }),
  ]);
  await assert.rejects(client.fixtures(), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, 9);
    return true;
  });
});

test('rate limit headers are remembered', async () => {
  const { client } = makeClient([fakeResponse(200, { success: 1, data: [] }, {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': '9',
    'X-RateLimit-Reset': '1755590400',
  })]);
  await client.fixtures();
  assert.deepEqual(client.rateLimit, { limit: 10, remaining: 9, reset: 1755590400 });
});
