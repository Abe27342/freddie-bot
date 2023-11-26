/// <reference types="vitest" />
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	test: {
		testTimeout: process.env.DEBUGGING ? 999_999_999 : 5_000,
		hookTimeout: process.env.DEBUGGING ? 999_999_999 : 10_000,
		env: {
			USE_LOCAL_SERVICE: 'true',
			CLIENT_ID: '1018247467856298055',
		},
	},
});
