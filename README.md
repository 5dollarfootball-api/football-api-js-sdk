# 5DollarFootballAPI — Node.js client

Official Node.js client for the [5DollarFootballAPI](https://5dollarfootballapi.com): football (soccer) fixtures, live scores, standings, statistics and odds — including full **odds movement history** and **corner & card lines** most football APIs don't carry.

- 15 endpoints, one method each — mirrors the [API docs](https://5dollarfootballapi.com/docs) exactly
- Zero dependencies — built on the native `fetch` (Node 18+)
- Automatic retry on rate limits, honoring `Retry-After`
- Typed errors (`AuthenticationError`, `RateLimitError`, ...) with the API's error code and `requestId`
- TypeScript definitions included
- Async iterator that walks `has_more` pages for you

Also available for Python: [`pip install fivedollarfootball`](https://github.com/5dollarfootball-api/football-api-python-sdk).

## Install

```bash
npm install fivedollarfootball
```

## Quickstart

Grab a free API key at [5dollarfootballapi.com](https://5dollarfootballapi.com) — the free tier covers the top-5 European leagues, no credit card required.

```js
const { Client } = require('fivedollarfootball');

const client = new Client('fb_live_your_key');

// Today's fixtures (kickoff window defaults to today UTC)
const { data: matches } = await client.fixtures();
for (const match of matches) {
  console.log(`${match.teams.home.name} vs ${match.teams.away.name} - ${match.status}`);
}

// Live matches only
const live = await client.fixtures({ status: 'live' });

// One fixture with events and statistics included
const fixture = await client.fixture(1234567, { include: ['events', 'stats'] });
```

ESM works too: `import { Client } from 'fivedollarfootball'`.

## Odds and odds history

```js
// Current prices for a fixture: 1x2, Asian handicap, goal line, corners, cards, BTTS
const odds = await client.fixtureOdds(1234567, { bookmakers: ['bet365', 'pinnacle'], market: '1x2' });

// Every recorded price movement for a market — the endpoint most APIs don't have
for await (const tick of client.iterAll((p) => client.oddsHistory(1234567, 'corner', p))) {
  console.log(tick);
}

// Which bookmakers are available on your plan
const books = await client.bookmakers();
```

## Leagues, teams, standings

```js
const { data: leagues } = await client.leagues({ popular: true });
const leagueId = leagues[0].id;

// A league season's fixtures
const { data: finished } = await client.leagueFixtures(leagueId, { status: 'finished' });

// League table — also as corner or card standings
const table = await client.standings(leagueId);
const cornerTable = await client.standings(leagueId, { type: 'corner' });

const teamId = finished[0].teams.home.id;
const team = await client.team(teamId);
const recent = await client.teamFixtures(teamId, { status: 'finished' });
```

## Pagination

Paginated methods return `{ data, pagination }` where `pagination` is `{ page, per_page, count, has_more }`. To walk every page:

```js
for await (const fixture of client.iterAll((p) => client.fixtures({ status: 'finished', ...p }))) {
  // ...
}
```

## Time windows

`startTime` / `endTime` accept unix seconds or `Date` objects:

```js
const start = new Date('2026-08-22T00:00:00Z');
const end = new Date(start.getTime() + 24 * 3600 * 1000);
const weekend = await client.fixtures({ startTime: start, endTime: end });
```

## Errors and rate limits

```js
const { APIError, RateLimitError } = require('fivedollarfootball');

try {
  await client.fixture(999999999);
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log('try again in', err.retryAfter, 'seconds');
  } else if (err instanceof APIError) {
    console.log(err.status, err.code, err.message, err.requestId);
  }
}
```

The client retries 429 responses automatically (`maxRetries: 2` by default) and exposes the latest rate-limit headers on `client.rateLimit`:

```js
await client.status();
console.log(client.rateLimit); // { limit: 10, remaining: 9, reset: 1755590400 }
```

## Links

- [API documentation](https://5dollarfootballapi.com/docs)
- [Pricing](https://5dollarfootballapi.com/pricing) — Free / $5 / $25 tiers
- [League coverage](https://5dollarfootballapi.com/coverage)

## Development

```bash
npm test
```

## License

[MIT](LICENSE)
