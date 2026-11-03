import {readFile} from 'node:fs/promises';
import path from 'node:path';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const missing = [
	['GOOGLE_CLIENT_ID', clientId],
	['GOOGLE_CLIENT_SECRET', clientSecret],
	['GOOGLE_REFRESH_TOKEN', refreshToken],
	['GOOGLE_DRIVE_FOLDER_ID', folderId],
	['GOOGLE_SHEET_ID', spreadsheetId],
]
	.filter(([, value]) => !value)
	.map(([name]) => name);

if (missing.length > 0) {
	throw new Error(`Missing Google delivery configuration: ${missing.join(', ')}`);
}

const episode = JSON.parse(
	await readFile(path.resolve('out/episode.json'), 'utf8'),
);
const videoPath = path.resolve('out/reel.mp4');
const video = await readFile(videoPath);

if (
	!episode ||
	typeof episode.date !== 'string' ||
	!/^\d{4}-\d{2}-\d{2}$/.test(episode.date) ||
	!Number.isInteger(episode.episode) ||
	episode.episode < 1 ||
	typeof episode.title !== 'string' ||
	typeof episode.caption !== 'string' ||
	!Array.isArray(episode.hashtags) ||
	!episode.hashtags.every((tag) => typeof tag === 'string') ||
	!Array.isArray(episode.keywords) ||
	!episode.keywords.every((keyword) => typeof keyword === 'string') ||
	video.length === 0
) {
	throw new Error(
		'out/episode.json or out/reel.mp4 is missing required delivery data.',
	);
}

const videoName = `${episode.date}-episode-${String(episode.episode).padStart(3, '0')}.mp4`;
const sheetName = 'Reels';
const headers = [
	'Video name',
	'Topic',
	'Caption',
	'Hashtags',
	'SEO keywords',
	'Google Drive link',
	'Generated date',
	'Episode',
];
const row = [
	videoName,
	episode.title,
	episode.caption,
	episode.hashtags.join(' '),
	episode.keywords.join(', '),
	'',
	episode.date,
	episode.episode,
];

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
	method: 'POST',
	headers: {'Content-Type': 'application/x-www-form-urlencoded'},
	body: new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
		grant_type: 'refresh_token',
	}),
});
if (!tokenResponse.ok) {
	throw new Error(
		`Google access-token refresh failed (${tokenResponse.status}): ${await tokenResponse.text()}`,
	);
}

const {access_token: accessToken} = await tokenResponse.json();
if (typeof accessToken !== 'string') {
	throw new Error('Google authentication returned no access token.');
}

const googleRequest = async (url, options = {}) => {
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			...options.headers,
		},
	});
	const responseText = await response.text();
	if (!response.ok) {
		throw new Error(
			`Google API request failed (${response.status}): ${responseText}`,
		);
	}

	return responseText ? JSON.parse(responseText) : {};
};

const escapeQueryValue = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const query = [
	`'${escapeQueryValue(folderId)}' in parents`,
	`name = '${escapeQueryValue(videoName)}'`,
	'trashed = false',
].join(' and ');
const listParams = new URLSearchParams({
	q: query,
	pageSize: '100',
	fields: 'files(id,name,webViewLink)',
	supportsAllDrives: 'true',
	includeItemsFromAllDrives: 'true',
});
const existingFiles = await googleRequest(
	`https://www.googleapis.com/drive/v3/files?${listParams}`,
);
const existingFile = existingFiles.files?.find(
	(file) => file.name === videoName,
);
let driveFile;

if (existingFile) {
	driveFile = await googleRequest(
		`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFile.id)}?uploadType=media`,
		{
			method: 'PATCH',
			headers: {'Content-Type': 'video/mp4'},
			body: video,
		},
	);
	driveFile.id = existingFile.id;
	driveFile.name = videoName;
	driveFile.webViewLink =
		driveFile.webViewLink ?? existingFile.webViewLink;
} else {
	const boundary = `remotion-reel-${Date.now()}`;
	const metadata = {
		name: videoName,
		mimeType: 'video/mp4',
		parents: [folderId],
	};
	const body = Buffer.concat([
		Buffer.from(
			`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
		),
		video,
		Buffer.from(`\r\n--${boundary}--`),
	]);
	driveFile = await googleRequest(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
		{
			method: 'POST',
			headers: {'Content-Type': `multipart/related; boundary=${boundary}`},
			body,
		},
	);
}

if (typeof driveFile.id !== 'string') {
	throw new Error('Google Drive returned no file ID after uploading the Reel.');
}

const driveLink =
	driveFile.webViewLink ?? `https://drive.google.com/file/d/${driveFile.id}/view`;
row[5] = driveLink;

const spreadsheetParams = new URLSearchParams({
	fields: 'sheets.properties(sheetId,title)',
});
const spreadsheet = await googleRequest(
	`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${spreadsheetParams}`,
);
const tabExists = spreadsheet.sheets?.some(
	(sheet) => sheet.properties?.title === sheetName,
);

if (!tabExists) {
	await googleRequest(
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
		{
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				requests: [{addSheet: {properties: {title: sheetName}}}],
			}),
		},
	);
}

const headerRange = encodeURIComponent(`'${sheetName}'!A1:H1`);
const namesRange = encodeURIComponent(`'${sheetName}'!A:A`);
const allRowsRange = encodeURIComponent(`'${sheetName}'!A:H`);
const currentHeader = await googleRequest(
	`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${headerRange}`,
);
if (!currentHeader.values?.length) {
	await googleRequest(
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${headerRange}?valueInputOption=RAW`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({values: [headers]}),
		},
	);
} else if (!headers.every((header, index) => currentHeader.values[0]?.[index] === header)) {
	throw new Error(
		`The first row of the "${sheetName}" tab must contain these headers: ${headers.join(' | ')}`,
	);
}

const existingNames = await googleRequest(
	`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${namesRange}`,
);
const existingRowIndex = existingNames.values?.findIndex(
	(existingRow) => existingRow[0] === videoName,
);
if (existingRowIndex !== undefined && existingRowIndex >= 0) {
	const rowNumber = existingRowIndex + 1;
	const updateRange = encodeURIComponent(
		`'${sheetName}'!A${rowNumber}:H${rowNumber}`,
	);
	await googleRequest(
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=RAW`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({values: [row]}),
		},
	);
} else {
	await googleRequest(
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${allRowsRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({values: [row]}),
		},
	);
}

console.log(`Saved ${videoName} to Google Drive and updated the ${sheetName} sheet.`);
