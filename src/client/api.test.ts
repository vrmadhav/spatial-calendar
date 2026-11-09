import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionResponseSchema } from '../shared/contracts';
import { request } from './api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('client boundary', () => {
  it('aborts after eight seconds and does not retry a mutation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); }));
    vi.stubGlobal('fetch', fetcher);
    const pending = expect(request('/accounts', null, { method: 'POST', body: { profileId: 'sam' } })).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(8000); await pending; expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('cancels when its owning component cancels', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); })));
    const pending = expect(request('/session', sessionResponseSchema, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await pending;
  });
  it('uses safe fallback for invalid server error envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream error</html>', { status: 502 })));
    await expect(request('/session', sessionResponseSchema)).rejects.toThrow('could not complete');
  });
});
