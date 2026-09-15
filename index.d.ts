/** Official Node.js client for the 5DollarFootballAPI — https://5dollarfootballapi.com */

export const DEFAULT_BASE_URL: string;

export class FiveDollarFootballError extends Error {}

export class APIError extends FiveDollarFootballError {
  status: number | null;
  type: string | null;
  code: string | null;
  param: string | null;
  docUrl: string | null;
  requestId: string | null;
}

export class AuthenticationError extends APIError {}
export class PermissionDeniedError extends APIError {}
export class NotFoundError extends APIError {}
export class ValidationError extends APIError {}
export class ServerError extends APIError {}
export class RateLimitError extends APIError {
  retryAfter: number | null;
}

export interface ClientOptions {
  baseUrl?: string;
  /** Per-request timeout in milliseconds (default 15000). */
  timeout?: number;
  /** Retries on 429, honoring Retry-After (default 2). */
  maxRetries?: number;
  fetch?: typeof fetch;
}

export interface Pagination {
  page: number;
  per_page: number;
  count: number;
  has_more: boolean;
}

export interface Paged<T = any> {
  data: T[];
  pagination: Pagination | null;
}

export interface RateLimitState {
  limit: number;
  remaining: number;
  reset: number;
}

/** Filter values; each selects the rows whose `status` field carries that label (`live` selects `in_play`). */
export type FixtureStatus = 'all' | 'scheduled' | 'live' | 'finished' | 'unknown';

/** Kickoff order on the league and team fixture lists; 'desc' is the API default. */
export type FixtureOrder = 'asc' | 'desc';
export type Timestamp = number | Date;
export type Includes = string | string[];

export interface PageParams {
  page?: number;
  perPage?: number;
}

export interface FixtureWindowParams extends PageParams {
  startTime?: Timestamp;
  endTime?: Timestamp;
  status?: FixtureStatus;
  include?: Includes;
  lang?: string;
}

export class Client {
  constructor(apiKey: string, options?: ClientOptions);

  /** Rate-limit state of the most recent response, or null before the first call. */
  rateLimit: RateLimitState | null;

  status(): Promise<any>;
  countries(params?: PageParams & { search?: string; lang?: string }): Promise<Paged>;
  bookmakers(): Promise<any[]>;

  leagues(params?: PageParams & {
    popular?: boolean;
    /** Country code as listed by countries(), e.g. 'DE' or 'GB-ENG' (a numeric id is still accepted for legacy accounts). */
    country?: string | number;
    search?: string; esports?: boolean;
    /** 'seasons' folds each league's seasons array into the list. */
    include?: 'seasons';
    lang?: string;
  }): Promise<Paged>;
  league(leagueId: number, params?: { lang?: string }): Promise<any>;
  leagueFixtures(leagueId: number, params?: FixtureWindowParams & { season?: number | string; order?: FixtureOrder }): Promise<Paged>;

  team(teamId: number, params?: { lang?: string }): Promise<any>;
  teamFixtures(teamId: number, params?: FixtureWindowParams & { order?: FixtureOrder }): Promise<Paged>;

  standings(league: number, params?: {
    season?: number | string; type?: 'total' | 'corner' | 'card'; lang?: string;
  }): Promise<any>;

  fixtures(params?: FixtureWindowParams & { league?: number; esports?: boolean }): Promise<Paged>;
  fixture(fixtureId: number, params?: { include?: Includes; lang?: string }): Promise<any>;
  fixtureStatistics(fixtureId: number): Promise<any>;
  fixtureEvents(fixtureId: number): Promise<any[]>;
  fixtureOdds(fixtureId: number, params?: { bookmakers?: Includes; market?: string }): Promise<any>;
  oddsHistory(fixtureId: number, market: string, params?: PageParams & { bookmaker?: string }): Promise<Paged & {
    fixtureId?: number; bookmaker?: string; market?: string;
  }>;

  iterAll<T = any>(
    fn: (params: { page: number }) => Promise<Paged<T>>,
    options?: { page?: number },
  ): AsyncGenerator<T>;
}
