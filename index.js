'use strict';

/**
 * Official Node.js client for the 5DollarFootballAPI (https://5dollarfootballapi.com).
 *
 * Every public method maps 1:1 to a documented endpoint under
 * https://api.5dollarfootballapi.com/v1 — see https://5dollarfootballapi.com/docs
 * for parameter semantics and response fields.
 */

const DEFAULT_BASE_URL = 'https://api.5dollarfootballapi.com/v1';

class FiveDollarFootballError extends Error {}

class APIError extends FiveDollarFootballError {
  constructor(message, info = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = info.status ?? null;
    this.type = info.type ?? null;
    this.code = info.code ?? null;
    this.param = info.param ?? null;
    this.docUrl = info.docUrl ?? null;
    this.requestId = info.requestId ?? null;
  }
}

class AuthenticationError extends APIError {}
class PermissionDeniedError extends APIError {}
class NotFoundError extends APIError {}
class ValidationError extends APIError {}
class ServerError extends APIError {}

class RateLimitError extends APIError {
  constructor(message, info = {}) {
    super(message, info);
    this.retryAfter = info.retryAfter ?? null;
  }
}

function errorClassFor(status) {
  if (status >= 500) return ServerError;
  switch (status) {
    case 400:
    case 422:
      return ValidationError;
    case 401:
      return AuthenticationError;
    case 403:
      return PermissionDeniedError;
    case 404:
      return NotFoundError;
    case 429:
      return RateLimitError;
    default:
      return APIError;
  }
}

/** Drop null/undefined and serialize values the way the API expects. */
function cleanParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') out[key] = value ? 'true' : 'false';
    else if (value instanceof Date) out[key] = String(Math.floor(value.getTime() / 1000));
    else if (Array.isArray(value)) out[key] = value.join(',');
    else out[key] = String(value);
  }
  return out;
}

function intHeader(response, name) {
  const raw = response.headers.get(name);
  if (raw === null) return null;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

class Client {
  /**
   * @param {string} apiKey your key from https://5dollarfootballapi.com (fb_live_...)
   * @param {object} [options]
   * @param {string} [options.baseUrl] override the API host (rarely needed)
   * @param {number} [options.timeout] per-request timeout in milliseconds (default 15000)
   * @param {number} [options.maxRetries] retries on 429, honoring Retry-After (default 2)
   * @param {typeof fetch} [options.fetch] custom fetch implementation
   */
  constructor(apiKey, options = {}) {
    if (!apiKey) throw new FiveDollarFootballError('apiKey is required — get one at https://5dollarfootballapi.com');
    this._apiKey = apiKey;
    this._baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this._timeout = options.timeout ?? 15000;
    this._maxRetries = options.maxRetries ?? 2;
    this._fetch = options.fetch || fetch;
    /** Rate-limit state of the most recent response, or null before the first call. */
    this.rateLimit = null;
  }

  async _get(path, params = {}) {
    const query = new URLSearchParams(cleanParams(params)).toString();
    const url = `${this._baseUrl}${path}${query ? `?${query}` : ''}`;
    const headers = {
      Authorization: `Bearer ${this._apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'fivedollarfootball-js',
    };

    let response;
    for (let attempt = 0; ; attempt++) {
      response = await this._fetch(url, {
        headers,
        signal: AbortSignal.timeout(this._timeout),
      });
      this._rememberRateLimit(response);
      if (response.status !== 429 || attempt >= this._maxRetries) break;
      await sleep(intHeader(response, 'Retry-After') || 1);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // fall through to the error path with a null payload
    }

    if (response.status >= 400 || !payload || !payload.success) {
      throw this._buildError(response, payload, url);
    }
    return payload;
  }

  _rememberRateLimit(response) {
    const limit = intHeader(response, 'X-RateLimit-Limit');
    if (limit !== null) {
      this.rateLimit = {
        limit,
        remaining: intHeader(response, 'X-RateLimit-Remaining') ?? 0,
        reset: intHeader(response, 'X-RateLimit-Reset') ?? 0,
      };
    }
  }

  _buildError(response, payload, url) {
    const error = (payload && payload.error) || {};
    const message = error.message || `HTTP ${response.status} from ${url}`;
    const Cls = errorClassFor(response.status);
    const info = {
      status: response.status,
      type: error.type,
      code: error.code,
      param: error.param,
      docUrl: error.doc_url,
      requestId: error.request_id,
    };
    if (Cls === RateLimitError) info.retryAfter = intHeader(response, 'Retry-After');
    return new Cls(message, info);
  }

  _paged(payload) {
    return { data: payload.data || [], pagination: payload.pagination || null };
  }

  // ---------------------------------------------------------------- meta

  /** GET /v1/status — your plan, usage and rate-limit state. */
  async status() {
    return (await this._get('/status')).data;
  }

  /** GET /v1/countries */
  async countries({ search, lang, page, perPage } = {}) {
    return this._paged(await this._get('/countries', { search, lang, page, per_page: perPage }));
  }

  /** GET /v1/bookmakers — the bookmaker slugs usable in odds calls. */
  async bookmakers() {
    return (await this._get('/bookmakers')).data;
  }

  // ------------------------------------------------------------- leagues

  /** GET /v1/leagues */
  async leagues({ popular, country, search, esports, lang, page, perPage } = {}) {
    return this._paged(await this._get('/leagues', {
      popular, country, search, esports, lang, page, per_page: perPage,
    }));
  }

  /** GET /v1/leagues/{id} */
  async league(leagueId, { lang } = {}) {
    return (await this._get(`/leagues/${leagueId}`, { lang })).data;
  }

  /** GET /v1/leagues/{id}/fixtures — a league season's matches. */
  async leagueFixtures(leagueId, { season, startTime, endTime, status, include, lang, page, perPage } = {}) {
    return this._paged(await this._get(`/leagues/${leagueId}/fixtures`, {
      season, start_time: startTime, end_time: endTime, status, include, lang, page, per_page: perPage,
    }));
  }

  // --------------------------------------------------------------- teams

  /** GET /v1/teams/{id} */
  async team(teamId, { lang } = {}) {
    return (await this._get(`/teams/${teamId}`, { lang })).data;
  }

  /** GET /v1/teams/{id}/fixtures — a team's matches, most recent first. */
  async teamFixtures(teamId, { status, startTime, endTime, include, lang, page, perPage } = {}) {
    return this._paged(await this._get(`/teams/${teamId}/fixtures`, {
      status, start_time: startTime, end_time: endTime, include, lang, page, per_page: perPage,
    }));
  }

  // ----------------------------------------------------------- standings

  /** GET /v1/standings — league table; type: total | corner | card. */
  async standings(league, { season, type, lang } = {}) {
    return (await this._get('/standings', { league, season, type, lang })).data;
  }

  // ------------------------------------------------------------ fixtures

  /** GET /v1/fixtures — fixtures in a kickoff window (default: today UTC). */
  async fixtures({ startTime, endTime, league, status, include, esports, lang, page, perPage } = {}) {
    return this._paged(await this._get('/fixtures', {
      start_time: startTime, end_time: endTime, league, status, include, esports,
      lang, page, per_page: perPage,
    }));
  }

  /** GET /v1/fixtures/{id} */
  async fixture(fixtureId, { include, lang } = {}) {
    return (await this._get(`/fixtures/${fixtureId}`, { include, lang })).data;
  }

  /** GET /v1/fixtures/{id}/statistics */
  async fixtureStatistics(fixtureId) {
    return (await this._get(`/fixtures/${fixtureId}/statistics`)).data;
  }

  /** GET /v1/fixtures/{id}/events — goals, cards, corners as a timeline. */
  async fixtureEvents(fixtureId) {
    return (await this._get(`/fixtures/${fixtureId}/events`)).data;
  }

  /** GET /v1/fixtures/{id}/odds — current prices per bookmaker and market. */
  async fixtureOdds(fixtureId, { bookmakers, market } = {}) {
    return (await this._get(`/fixtures/${fixtureId}/odds`, { bookmakers, market })).data;
  }

  /** GET /v1/fixtures/{id}/odds/history — every recorded price movement. */
  async oddsHistory(fixtureId, market, { bookmaker, page, perPage } = {}) {
    return this._paged(await this._get(`/fixtures/${fixtureId}/odds/history`, {
      market, bookmaker, page, per_page: perPage,
    }));
  }

  // ---------------------------------------------------------- pagination

  /**
   * Async-iterate every item across all pages of a paginated method.
   *
   * @example
   * for await (const fixture of client.iterAll((p) => client.fixtures({ status: 'finished', ...p }))) { ... }
   */
  async *iterAll(fn, { page = 1 } = {}) {
    for (;;) {
      const { data, pagination } = await fn({ page });
      yield* data;
      if (!pagination || !pagination.has_more) return;
      page++;
    }
  }
}

module.exports = {
  Client,
  DEFAULT_BASE_URL,
  FiveDollarFootballError,
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
};
