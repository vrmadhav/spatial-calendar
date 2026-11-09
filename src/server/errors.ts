export class ApiFailure extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
  }
}
export const notFound = () => new ApiFailure(404, 'NOT_FOUND', 'Resource not found');
export const forbidden = () => new ApiFailure(403, 'FORBIDDEN', 'This action is not permitted');
export const providerUnavailable = () => new ApiFailure(502, 'PROVIDER_UNAVAILABLE', 'The simulated provider is unavailable. Try syncing again.', true);
