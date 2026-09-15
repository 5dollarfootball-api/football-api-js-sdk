# Changelog

## 0.1.3 — 2026-09-15

- `leagueFixtures()` and `teamFixtures()` take `order` (`'desc'`, the API default, or `'asc'`), typed as `FixtureOrder`.
- API change, no client change needed: `/v1/leagues/{id}/fixtures` now answers newest kickoff first, so page 1 is the current season. It previously started at the oldest data the plan could reach — on Ultra, January 2014. Code that relied on the old order should pass `order: 'asc'`.
- Note on both fixture methods: offset paging is not stable in either order, because the plan's history floor is relative to now. Pin the window with `startTime`/`endTime` to walk a full history reproducibly.

## 0.1.2 — 2026-09-06

- `leagues({ include: 'seasons' })` folds each league's seasons array into the list (API: `/v1/leagues?include=seasons`).
- `leagues({ country })` is typed as a country code string (the API addresses countries by code, e.g. `'DE'`, `'GB-ENG'`); a numeric id is still accepted for legacy accounts.
- `FixtureStatus` gains `'unknown'`: the API now reports it (with a `status_reason`) for rows the feed lost, and `status: 'unknown'` filters for them.
- The `User-Agent` header now carries the package version.

## 0.1.1 — 2026-08-22

- Fix `oddsHistory`: unwrap the tick list from the `data` envelope; the result now exposes `data`, `pagination`, `fixtureId`, `bookmaker` and `market`.
- Repository metadata points at the package's GitHub home.

## 0.1.0 — 2026-08-22

- Initial release: one method per `/v1` endpoint, zero dependencies (native fetch), automatic 429 retries, typed errors, `iterAll` pagination helper, TypeScript definitions.
