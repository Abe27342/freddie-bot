import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../../.env`,
});
