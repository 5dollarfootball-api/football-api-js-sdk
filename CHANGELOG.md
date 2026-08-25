# Changelog

## Unreleased

- The `User-Agent` header now carries the package version.

## 0.1.1 — 2026-08-22

- Fix `oddsHistory`: unwrap the tick list from the `data` envelope; the result now exposes `data`, `pagination`, `fixtureId`, `bookmaker` and `market`.
- Repository metadata points at the package's GitHub home.

## 0.1.0 — 2026-08-22

- Initial release: one method per `/v1` endpoint, zero dependencies (native fetch), automatic 429 retries, typed errors, `iterAll` pagination helper, TypeScript definitions.
