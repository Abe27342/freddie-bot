/**
 * Options for retry behavior
 */
export interface RetryOptions {
	/**
	 * Maximum number of attempts (including the initial attempt)
	 * @default 3
	 */
	maxRetries?: number;

	/**
	 * Base delay in milliseconds for exponential backoff
	 * @default 1000
	 */
	baseDelayMs?: number;

	/**
	 * Function to determine if an error should trigger a retry
	 * Return true to retry, false to fail immediately
	 * @default () => true (retry all errors)
	 */
	shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Executes an async function with exponential backoff retry logic
 * @param fn - The async function to execute
 * @param options - Retry options
 * @returns The result of the function or throws the last error
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, shouldRetry: (err) => !err.message.includes('not found') }
 * );
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const {
		maxRetries = 3,
		baseDelayMs = 1000,
		shouldRetry = () => true,
	} = options;

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError =
				error instanceof Error ? error : new Error(String(error));

			// Check if we should retry this error
			if (!shouldRetry(lastError, attempt)) {
				throw lastError;
			}

			// Don't wait after the last attempt
			if (attempt < maxRetries) {
				await new Promise((resolve) =>
					setTimeout(resolve, baseDelayMs * attempt)
				);
			}
		}
	}

	// All retries exhausted
	throw lastError;
}
