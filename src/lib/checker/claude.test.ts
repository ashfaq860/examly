import { describe, it, expect } from 'vitest';
import { APIConnectionError, APIConnectionTimeoutError, AuthenticationError, BadRequestError } from '@anthropic-ai/sdk';
import { describeClaudeError, isRetryableErrorKind, hashPromptPrefix } from './claude';

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('describeClaudeError', () => {
  it('classifies a connection error and surfaces the real cause code, not just "Connection error."', () => {
    const cause = withCode('other side closed the connection', 'ECONNRESET');
    const err = new APIConnectionError({ cause });
    const info = describeClaudeError(err);
    expect(info.kind).toBe('network');
    expect(info.code).toBe('ECONNRESET');
    expect(info.summary).toContain('ECONNRESET');
  });

  it('classifies a timeout distinctly from a generic connection error', () => {
    const err = new APIConnectionTimeoutError({});
    const info = describeClaudeError(err);
    expect(info.kind).toBe('timeout');
  });

  it('walks nested .cause chains (not just one level) to find a node error code', () => {
    const innermost = withCode('socket hang up', 'ECONNRESET');
    const middle = new Error('wrapped once', { cause: innermost });
    const err = new APIConnectionError({ cause: middle });
    const info = describeClaudeError(err);
    expect(info.code).toBe('ECONNRESET');
  });

  it('classifies an insufficient-credit BadRequestError as billing, using the nested API message', () => {
    const body = { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } };
    const err = new BadRequestError(400, body, undefined, new Headers(), 'invalid_request_error');
    const info = describeClaudeError(err);
    expect(info.kind).toBe('billing');
    expect(info.summary).toBe(body.error.message);
  });

  it('classifies a non-billing BadRequestError as bad_request, not billing', () => {
    const body = { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens is too large' } };
    const err = new BadRequestError(400, body, undefined, new Headers(), 'invalid_request_error');
    const info = describeClaudeError(err);
    expect(info.kind).toBe('bad_request');
  });

  it('classifies an AuthenticationError as auth', () => {
    const body = { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } };
    const err = new AuthenticationError(401, body, undefined, new Headers(), 'authentication_error');
    const info = describeClaudeError(err);
    expect(info.kind).toBe('auth');
  });

  it('classifies a bare node error with a known network code even without going through the SDK (e.g. Supabase Storage)', () => {
    const err = withCode('fetch failed', 'ENOTFOUND');
    const info = describeClaudeError(err);
    expect(info.kind).toBe('network');
    expect(info.code).toBe('ENOTFOUND');
  });

  it('falls back to unknown for something with no recognizable shape, without throwing', () => {
    expect(() => describeClaudeError({ weird: true })).not.toThrow();
    expect(describeClaudeError('a plain string throw').kind).toBe('unknown');
    expect(describeClaudeError(null).kind).toBe('unknown');
  });
});

describe('isRetryableErrorKind', () => {
  it('treats network/timeout/unknown as worth retrying', () => {
    expect(isRetryableErrorKind('network')).toBe(true);
    expect(isRetryableErrorKind('timeout')).toBe(true);
    expect(isRetryableErrorKind('unknown')).toBe(true);
  });
  it('treats billing/auth/bad_request as guaranteed to fail again, not worth retrying', () => {
    expect(isRetryableErrorKind('billing')).toBe(false);
    expect(isRetryableErrorKind('auth')).toBe(false);
    expect(isRetryableErrorKind('bad_request')).toBe(false);
  });
});

describe('hashPromptPrefix', () => {
  it('is stable for identical text (same prefix -> same hash, matching what two students of the same paper should log)', () => {
    const text = 'Question 13 (short answer, 2 marks):\nEnglish: What is a firewall?';
    expect(hashPromptPrefix(text)).toBe(hashPromptPrefix(text));
  });
  it('differs for different text', () => {
    expect(hashPromptPrefix('a')).not.toBe(hashPromptPrefix('b'));
  });
  it('is a 12-char lowercase hex string', () => {
    expect(hashPromptPrefix('x')).toMatch(/^[0-9a-f]{12}$/);
  });
});
