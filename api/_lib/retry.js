// Exponential backoff retry wrapper for async functions.

/**
 * Wraps an async function with retry logic.
 * Retries on network errors, 429 (rate limit), 500/503 (server errors).
 * Does NOT retry on 400, 401, 403, 404.
 *
 * @param {Function} fn - async function to retry
 * @param {number} maxRetries - max number of retries (default 3)
 * @param {number} baseDelayMs - initial delay in ms (default 1000)
 * @returns {Promise<any>}
 */
export async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode;

      // Don't retry client errors
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
