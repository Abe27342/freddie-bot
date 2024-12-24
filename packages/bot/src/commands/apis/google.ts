import '../../register-env/index.js';
import { google, sheets_v4 } from 'googleapis';

/**
 * @param sheetId The ID of the spreadsheet to retrieve data from.
 * @param range The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.
 * @returns Unformatted spreadsheet values without any validation (i.e. TRow is assumed and should be validated by the caller)
 */
export async function querySpreadsheet<TRow extends any[]>(
	sheetId: string,
	range: string
): Promise<TRow[]> {
	const auth = new google.auth.GoogleAuth({
		credentials: JSON.parse(process.env.GOOGLE_API_KEY),
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	});
	google.options({ auth });
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

export async function createSheetFromTemplate({
	name,
	templateId,
	folderId,
}: {
	name: string;
	templateId: string;
	folderId: string;
}): Promise<string> {
	const auth = new google.auth.GoogleAuth({
		credentials: JSON.parse(process.env.GOOGLE_API_KEY),
		scopes: ['https://www.googleapis.com/auth/drive.file'],
	});
	google.options({ auth });
	const drive = google.drive({ version: 'v3' });
	const file = await drive.files.copy({
		fileId: templateId,
		requestBody: {
			name,
			parents: [folderId],
			mimeType: 'application/vnd.google-apps.spreadsheet',
		},
	});
	return file.data.id;
}

export async function updateSheetValues(
	params: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate
): Promise<void> {
	const auth = new google.auth.GoogleAuth({
		credentials: JSON.parse(process.env.GOOGLE_API_KEY),
		scopes: ['https://www.googleapis.com/auth/drive.file'],
	});
	google.options({ auth });
	const sheets = google.sheets({ version: 'v4' });
	const response = await sheets.spreadsheets.values.batchUpdate(params);

	if (response.status !== 200) {
		console.log(response);
		throw new Error(`Issue updating data: ${response.statusText}`);
	}
}
