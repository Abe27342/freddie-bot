import '../../register-env/index.js';
import { google } from 'googleapis';

let isInitialized = false;

/**
 * @param sheetId The ID of the spreadsheet to retrieve data from.
 * @param range The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.
 * @returns Unformatted spreadsheet values without any validation (i.e. TRow is assumed and should be validated by the caller)
 */
export async function querySpreadsheet<TRow extends any[]>(
	sheetId: string,
	range: string
): Promise<TRow[]> {
	if (!isInitialized) {
		// Do this lazily to allow module load in environments that don't have access to the google api key (ex: command deployment)
		const auth = new google.auth.GoogleAuth({
			credentials: JSON.parse(process.env.GOOGLE_API_KEY),
			scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
		});
		google.options({ auth });
		isInitialized = true;
	}
	const sheets = google.sheets({ version: 'v4' });
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: sheetId,
		range,
		valueRenderOption: 'UNFORMATTED_VALUE',
	});

	if (response.status !== 200) {
		console.log(response);
		throw new Error(`Issue fetching data: ${response.statusText}`);
	}

	return response.data.values as TRow[];
}
