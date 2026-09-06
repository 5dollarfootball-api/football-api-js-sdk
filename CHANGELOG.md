# Changelog

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
