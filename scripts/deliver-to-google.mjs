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
	'YouTube URL',
	'YouTube status',
];
let row = [
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

const headerRange = encodeURIComponent(`'${sheetName}'!A1:J1`);
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
} else if (
	!headers
		.slice(0, 8)
		.every((header, index) => currentHeader.values[0]?.[index] === header)
) {
	throw new Error(
		`The first eight columns of the "${sheetName}" tab must contain these headers: ${headers.slice(0, 8).join(' | ')}`,
	);
}

if (
	currentHeader.values?.[0]?.[8] !== headers[8] ||
	currentHeader.values?.[0]?.[9] !== headers[9]
) {
	await googleRequest(
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${headerRange}?valueInputOption=RAW`,
		{
			method: 'PUT',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({values: [headers]}),
		},
	);
}

const existingRowsRange = encodeURIComponent(`'${sheetName}'!A:J`);
const currentRows = await googleRequest(
	`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${existingRowsRange}`,
);
const existingRowIndex = currentRows.values?.findIndex(
	(existingRow) => existingRow[0] === videoName,
);
const storedRow =
	existingRowIndex !== undefined && existingRowIndex >= 0
		? currentRows.values[existingRowIndex]
		: null;
let youtubeVideoId = storedRow?.[8]?.match(
	/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
)?.[1];
let driveLink = storedRow?.[5] ?? '';

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

if (!youtubeVideoId) {
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

	driveLink =
		driveFile.webViewLink ?? `https://drive.google.com/file/d/${driveFile.id}/view`;
	row[5] = driveLink;
} else {
	row = storedRow.slice(0, headers.length);
	console.log(
		`${videoName} is already public on YouTube; keeping the existing video and Drive file.`,
	);
}

const titleSuffix = ` | Stories That Stay Ep. ${episode.episode}`;
const youtubeTitle = `${episode.title.slice(0, 100 - titleSuffix.length)}${titleSuffix}`;
const hashtags = [...episode.hashtags];
if (!hashtags.some((tag) => tag.toLowerCase() === '#shorts')) {
	hashtags.push('#Shorts');
}
const attribution = episode.music?.attribution?.filter(Boolean).join('\n') ?? '';
const description = [episode.caption, hashtags.join(' '), attribution]
	.filter(Boolean)
	.join('\n\n')
	.slice(0, 5000);
const tags = [];
let tagCharacterCount = 0;
for (const tag of [
	...episode.hashtags.map((hashtag) => hashtag.replace(/^#/, '')),
	...episode.keywords,
]) {
	const normalizedTag = tag.trim();
	const addedLength = normalizedTag.length + (tags.length > 0 ? 1 : 0);
	if (
		normalizedTag &&
		tagCharacterCount + addedLength <= 500 &&
		!tags.includes(normalizedTag)
	) {
		tags.push(normalizedTag);
		tagCharacterCount += addedLength;
	}
}

let youtubeUrl = youtubeVideoId
	? `https://www.youtube.com/watch?v=${youtubeVideoId}`
	: '';
let youtubeStatus = youtubeVideoId ? 'Public' : '';

if (!youtubeVideoId) {
	const youtubeMetadata = {
		snippet: {
			title: youtubeTitle,
			description,
			tags,
			categoryId: '24',
		},
		status: {privacyStatus: 'public'},
	};
	const uploadUrl = new URL(
		'https://www.googleapis.com/upload/youtube/v3/videos',
	);
	uploadUrl.searchParams.set('uploadType', 'resumable');
	uploadUrl.searchParams.set('part', 'snippet,status');
	const metadataBody = JSON.stringify(youtubeMetadata);
	const uploadSession = await fetch(uploadUrl, {
		method: 'POST',
		headers: {
			Authorization: `******`,
			'Content-Type': 'application/json; charset=UTF-8',
			'X-Upload-Content-Length': String(video.length),
			'X-Upload-Content-Type': 'video/mp4',
		},
		body: metadataBody,
	});
	if (!uploadSession.ok) {
		throw new Error(
			`YouTube upload initialization failed (${uploadSession.status}): ${await uploadSession.text()}`,
		);
	}

	const resumableUrl = uploadSession.headers.get('Location');
	if (!resumableUrl) {
		throw new Error('YouTube returned no resumable upload URL.');
	}

	const uploadResponse = await fetch(resumableUrl, {
		method: 'PUT',
		headers: {
			Authorization: `******`,
			'Content-Type': 'video/mp4',
			'Content-Length': String(video.length),
		},
		body: video,
	});
	if (!uploadResponse.ok) {
		throw new Error(
			`YouTube video upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`,
		);
	}

	const uploadedVideo = await uploadResponse.json();
	if (typeof uploadedVideo.id !== 'string') {
		throw new Error('YouTube returned no video ID after upload.');
	}

	youtubeVideoId = uploadedVideo.id;
	youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
	youtubeStatus = 'Public';
	console.log(`Uploaded public YouTube Short: ${youtubeUrl}`);
}

row[8] = youtubeUrl;
row[9] = youtubeStatus;

if (existingRowIndex !== undefined && existingRowIndex >= 0) {
	const rowNumber = existingRowIndex + 1;
	const updateRange = encodeURIComponent(
		`'${sheetName}'!A${rowNumber}:J${rowNumber}`,
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
		`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${sheetName}'!A:J`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({values: [row]}),
		},
	);
}

console.log(`Saved ${videoName} to Google Drive and updated the ${sheetName} sheet.`);
