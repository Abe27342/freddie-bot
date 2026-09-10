import type { FreddieBotClient } from './types';

export const BOSS_TIMER_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const BOSS_TIMER_CLEANUP_BATCH_DELAY_MS = 1000;
export const BOSS_TIMER_CLEANUP_RETRY_DELAY_MS = 5000;
export const BOSS_TIMER_CLEANUP_MAX_RETRY_DELAY_MS = 60 * 1000;

export function startBossTimerCleanup(
	client: Pick<FreddieBotClient, 'bosses' | 'pushAsyncWork'>
): void {
	let retryDelay = BOSS_TIMER_CLEANUP_RETRY_DELAY_MS;

	function cleanup(): void {
		let nextDelay = BOSS_TIMER_CLEANUP_INTERVAL_MS;
		client.pushAsyncWork(
			'boss-timer',
			client.bosses
				.clearStaleBossTimers()
				.then(
					({ hasMore }) => {
						retryDelay = BOSS_TIMER_CLEANUP_RETRY_DELAY_MS;
						nextDelay = hasMore
							? BOSS_TIMER_CLEANUP_BATCH_DELAY_MS
							: BOSS_TIMER_CLEANUP_INTERVAL_MS;
					},
					(error) => {
						nextDelay = retryDelay;
						retryDelay = Math.min(
							retryDelay * 2,
							BOSS_TIMER_CLEANUP_MAX_RETRY_DELAY_MS
						);
						throw error;
					}
				)
				.finally(() => {
					// Schedule after completion to avoid overlapping queries.
					setTimeout(cleanup, nextDelay).unref();
				})
		);
	}

	setTimeout(cleanup, 0).unref();
}
