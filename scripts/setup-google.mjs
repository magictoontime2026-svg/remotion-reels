import {createHash, randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const clientFilePath = process.argv[2];
if (!clientFilePath) {
	throw new Error(
		'Pass the path to the downloaded Google Desktop OAuth client JSON file.',
	);
}

let clientFile;
try {
	clientFile = JSON.parse(await readFile(path.resolve(clientFilePath), 'utf8'));
} catch (error) {
	throw new Error(`Could not read the Google OAuth client JSON: ${error.message}`);
}

const oauthClient = clientFile.installed;
if (
	typeof oauthClient?.client_id !== 'string' ||
	typeof oauthClient.client_secret !== 'string'
) {
	throw new Error(
		'Use a Google Desktop OAuth client JSON with client_id and client_secret.',
	);
}

const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const server = createServer();
await new Promise((resolve, reject) => {
	server.once('error', reject);
	server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') {
	throw new Error('Could not start the local Google OAuth callback server.');
}

const redirectUri = `http://127.0.0.1:${address.port}/`;
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.search = new URLSearchParams({
	client_id: oauthClient.client_id,
	redirect_uri: redirectUri,
	response_type: 'code',
	scope: [
		'https://www.googleapis.com/auth/drive.file',
		'https://www.googleapis.com/auth/spreadsheets',
	].join(' '),
	access_type: 'offline',
	prompt: 'consent',
	code_challenge: challenge,
	code_challenge_method: 'S256',
	state,
}).toString();

console.log('Open this URL in your browser and authorize your Google account:');
console.log(authUrl.toString());

let authorizationCode;
try {
	authorizationCode = await new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('Google authorization timed out after five minutes.')),
			5 * 60 * 1000,
		);
		server.on('request', (request, response) => {
			const callbackUrl = new URL(request.url, redirectUri);
			if (callbackUrl.pathname !== '/') {
				response.writeHead(404);
				response.end('Not found.');
				return;
			}

			if (callbackUrl.searchParams.get('state') !== state) {
				response.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
				response.end('Authorization state did not match. You can close this tab.');
				clearTimeout(timeout);
				reject(new Error('Google OAuth state validation failed.'));
				return;
			}

			const error = callbackUrl.searchParams.get('error');
			if (error) {
				response.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
				response.end('Google authorization was not completed. You can close this tab.');
				clearTimeout(timeout);
				reject(new Error(`Google authorization failed: ${error}`));
				return;
			}

			const code = callbackUrl.searchParams.get('code');
			if (!code) {
				response.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
				response.end('Google did not return an authorization code.');
				clearTimeout(timeout);
				reject(new Error('Google authorization returned no code.'));
				return;
			}

			response.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
			response.end('Google authorization complete. You can close this tab.');
			clearTimeout(timeout);
			resolve(code);
		});
	});
} finally {
	await new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
	method: 'POST',
	headers: {'Content-Type': 'application/x-www-form-urlencoded'},
	body: new URLSearchParams({
		client_id: oauthClient.client_id,
		client_secret: oauthClient.client_secret,
		code: authorizationCode,
		code_verifier: verifier,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
	}),
});
if (!tokenResponse.ok) {
	throw new Error(
		`Google token exchange failed (${tokenResponse.status}): ${await tokenResponse.text()}`,
	);
}

const tokens = await tokenResponse.json();
if (typeof tokens.refresh_token !== 'string') {
	throw new Error(
		'Google returned no refresh token. Revoke this app in your Google Account permissions and run setup again.',
	);
}

const googleRequest = async (url, options = {}) => {
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${tokens.access_token}`,
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

const folderName = 'Stories That Stay Reels';
const folderQuery = new URLSearchParams({
	q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
	fields: 'files(id,name,webViewLink)',
	pageSize: '100',
});
const foundFolders = await googleRequest(
	`https://www.googleapis.com/drive/v3/files?${folderQuery}`,
);
let folder = foundFolders.files?.[0];
if (!folder) {
	folder = await googleRequest(
		'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
		{
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				name: folderName,
				mimeType: 'application/vnd.google-apps.folder',
			}),
		},
	);
}

if (typeof folder.id !== 'string') {
	throw new Error('Google Drive returned no folder ID.');
}

const spreadsheet = await googleRequest(
	'https://sheets.googleapis.com/v4/spreadsheets',
	{
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			properties: {title: 'Stories That Stay Content Calendar'},
			sheets: [{properties: {title: 'Reels'}}],
		}),
	},
);
if (typeof spreadsheet.spreadsheetId !== 'string') {
	throw new Error('Google Sheets returned no spreadsheet ID.');
}

const spreadsheetFile = await googleRequest(
	`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheet.spreadsheetId)}?fields=id,parents`,
);
const moveParams = new URLSearchParams({addParents: folder.id});
if (spreadsheetFile.parents?.length) {
	moveParams.set('removeParents', spreadsheetFile.parents.join(','));
}
await googleRequest(
	`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheet.spreadsheetId)}?${moveParams}`,
	{method: 'PATCH'},
);

const secretFilePath = path.resolve('google-oauth-secrets.json');
await writeFile(
	secretFilePath,
	`${JSON.stringify(
		{
			GOOGLE_CLIENT_ID: oauthClient.client_id,
			GOOGLE_CLIENT_SECRET: oauthClient.client_secret,
			GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
			GOOGLE_DRIVE_FOLDER_ID: folder.id,
			GOOGLE_SHEET_ID: spreadsheet.spreadsheetId,
		},
		null,
		2,
	)}\n`,
	{mode: 0o600},
);

console.log(`Created or reused the Drive folder: ${folderName}`);
console.log(`Folder URL: https://drive.google.com/drive/folders/${folder.id}`);
console.log(`Spreadsheet URL: ${spreadsheet.spreadsheetUrl}`);
console.log(`OAuth values were saved locally to ${secretFilePath}.`);
console.log('Add the three GOOGLE_* credentials as GitHub Actions secrets.');
console.log('Add the folder and spreadsheet IDs as GitHub Actions variables.');
