import type { z } from 'zod';
import { apiErrorSchema } from '../shared/contracts';

export async function request<T>(path: string, schema: z.ZodType<T> | null, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 8000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET', signal,
      headers: { 'X-Demo-User': 'demo-alex', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(await response.json().catch(() => null));
      throw new Error(error.success ? error.data.error.message : 'The calendar service could not complete this request.');
    }
    if (!schema) return undefined as T;
    const result = schema.safeParse(await response.json());
    if (!result.success) throw new Error('The calendar returned unexpected data. Please try again.');
    return result.data;
  } catch (error) {
    if (timeout.signal.aborted) throw new Error('The request timed out. Please try again.');
    if (error instanceof TypeError) throw new Error('Cannot reach the calendar. Check that the local server is running.');
    throw error;
  } finally { clearTimeout(timer); }
}
