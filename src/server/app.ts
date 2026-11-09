import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { connectAccountRequestSchema, idSchema, selectSourceRequestSchema, syncAccountRequestSchema } from '../shared/contracts.js';
import { ApiFailure, notFound, providerUnavailable } from './errors.js';
import { CalendarStore } from './store.js';

const BODY_LIMIT = 16 * 1024;
interface AccessLog { method: string; status: number; code?: string; durationMs: number }
export interface ServerOptions { store?: CalendarStore; deadlineMs?: number; logger?: (entry: AccessLog) => void }
function badInput(message = 'Invalid request body'): ApiFailure { return new ApiFailure(400, 'INVALID_INPUT', message); }

async function readBody(request: IncomingMessage, signal: AbortSignal, json: boolean): Promise<unknown> {
  if (json && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiFailure(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const contentLength = request.headers['content-length'];
  if (contentLength && Number(contentLength) > BODY_LIMIT) throw new ApiFailure(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KiB');
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      request.removeListener('data', data);
      request.removeListener('end', end);
      request.removeListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const fail = (error: Error) => { cleanup(); request.resume(); reject(error); };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) { fail(new ApiFailure(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KiB')); return; }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      if (!json) { if (size) reject(badInput('This request does not accept a body')); else resolve(undefined); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown); }
      catch { reject(badInput('Malformed JSON')); }
    };
    const failed = () => fail(badInput('Incomplete request body'));
    const aborted = () => fail(providerUnavailable());
    if (signal.aborted) { reject(providerUnavailable()); return; }
    request.on('data', data);
    request.once('end', end);
    request.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
  });
}
function checkOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  if (origin === undefined) return;
  try {
    const url = new URL(origin);
    if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return;
  } catch { /* Invalid origins are denied with the same safe response. */ }
  throw new ApiFailure(403, 'ORIGIN_FORBIDDEN', 'Writes require a local origin');
}
function respond(response: ServerResponse, status: number, body?: unknown): void {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  if (status === 204) { response.end(); return; }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

export function createServer(options: ServerOptions = {}) {
  const store = options.store ?? new CalendarStore();
  const deadlineMs = options.deadlineMs ?? 5000;
  const server = createHttpServer({ maxHeaderSize: 16 * 1024 }, (request, response) => {
    const start = performance.now();
    const controller = new AbortController();
    let errorCode: string | undefined;
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    const aborted = () => controller.abort();
    request.once('aborted', aborted);
    const route = async (): Promise<void> => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.search) throw badInput('Query parameters are not supported');
      const rawSegments = url.pathname.split('/').slice(1);
      let segments: string[];
      try { segments = rawSegments.map(decodeURIComponent); } catch { throw badInput('Invalid path'); }
      if (segments[0] !== 'api' || segments[1] !== 'v1') throw notFound();
      const method = request.method ?? 'GET';
      const health = segments.length === 3 && segments[2] === 'health';
      const session = segments.length === 3 && segments[2] === 'session';
      const household = segments[2] === 'households' && segments.length >= 5;
      const snapshot = household && segments.length === 5 && segments[4] === 'snapshot';
      const connect = household && segments.length === 5 && segments[4] === 'accounts';
      const select = household && segments.length === 6 && segments[4] === 'sources';
      const sync = household && segments.length === 7 && segments[4] === 'accounts' && segments[6] === 'sync';
      const disconnect = household && segments.length === 6 && segments[4] === 'accounts';
      const allowed = health || session || snapshot ? 'GET' : connect || sync ? 'POST' : select ? 'PATCH' : disconnect ? 'DELETE' : undefined;
      if (!allowed) throw notFound();
      if (method !== allowed) {
        response.setHeader('Allow', allowed);
        throw new ApiFailure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) checkOrigin(request);
      if (health) { await readBody(request, controller.signal, false); respond(response, 200, { status: 'ok', mode: 'demo' }); return; }
      const identity = request.headers['x-demo-user'];
      const user = store.authenticate(typeof identity === 'string' ? identity : undefined);
      if (session) { await readBody(request, controller.signal, false); respond(response, 200, store.session(user)); return; }
      const householdId = segments[3];
      if (!idSchema.safeParse(householdId).success) throw badInput('Invalid household ID');
      store.membership(user, householdId);
      const childId = segments[5];
      if (childId !== undefined && !idSchema.safeParse(childId).success) throw badInput('Invalid resource ID');
      const json = method === 'POST' || method === 'PATCH';
      const body = await readBody(request, controller.signal, json);
      if (controller.signal.aborted) throw providerUnavailable();
      if (snapshot) { respond(response, 200, store.snapshot(user, householdId)); return; }
      if (connect) {
        const parsed = connectAccountRequestSchema.safeParse(body);
        if (!parsed.success) throw badInput();
        respond(response, 201, await store.connect(user, householdId, parsed.data.profileId, controller.signal)); return;
      }
      if (select) {
        const parsed = selectSourceRequestSchema.safeParse(body);
        if (!parsed.success) throw badInput();
        respond(response, 200, store.selectSource(user, householdId, childId, parsed.data.selected)); return;
      }
      if (sync) {
        const parsed = syncAccountRequestSchema.safeParse(body);
        if (!parsed.success) throw badInput();
        respond(response, 200, await store.sync(user, householdId, childId, parsed.data.simulateFailure ?? false, controller.signal)); return;
      }
      store.disconnect(user, householdId, childId);
      respond(response, 204);
    };
    void route().catch((error: unknown) => {
      request.resume();
      const failure = error instanceof ApiFailure ? error : new ApiFailure(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
      errorCode = failure.code;
      if (!response.destroyed && !response.writableEnded) respond(response, failure.status, { error: { code: failure.code, message: failure.message, retryable: failure.retryable } });
    }).finally(() => {
      clearTimeout(timer);
      request.removeListener('aborted', aborted);
      options.logger?.({ method: request.method ?? 'UNKNOWN', status: response.statusCode, ...(errorCode ? { code: errorCode } : {}), durationMs: Math.round(performance.now() - start) });
    });
  });
  server.requestTimeout = deadlineMs;
  server.headersTimeout = deadlineMs;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}
