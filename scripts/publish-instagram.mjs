import {readFile} from 'node:fs/promises';
import path from 'node:path';

const required = [
	'IG_USER_ID',
	'IG_ACCESS_TOKEN',
	'META_GRAPH_API_VERSION',
	'CLOUDFLARE_ACCOUNT_ID',
	'R2_BUCKET',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'R2_PUBLIC_BASE_URL',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
	throw new Error(`Missing publishing configuration: ${missing.join(', ')}`);
}

const version = process.env.META_GRAPH_API_VERSION;
if (!/^v\d+\.\d+$/.test(version)) {
	throw new Error('META_GRAPH_API_VERSION must look like vNN.N.');
}

const episode = JSON.parse(
	await readFile(path.resolve('out/episode.json'), 'utf8'),
);
const tags = episode.hashtags.join(' ');
const attribution = episode.music?.attribution?.filter(Boolean).join('\n') ?? '';
const caption = [episode.caption, tags, attribution]
	.filter((part) => part.trim().length > 0)
	.join('\n\n');
if (caption.length > 2200) {
	throw new Error(
		`Instagram caption and required attribution exceed 2,200 characters (${caption.length}).`,
	);
}

const graphBase = `https://graph.facebook.com/${version}`;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
const objectKey = `reels/${episode.date}-episode-${String(episode.episode).padStart(3, '0')}.mp4`;
const videoUrl = `${publicBaseUrl}/${objectKey}`;
const authHeaders = {
	Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}`,
};

const createForm = new URLSearchParams({
	media_type: 'REELS',
	video_url: videoUrl,
	caption,
	share_to_feed: 'true',
});
const createResponse = await fetch(
	`${graphBase}/${encodeURIComponent(process.env.IG_USER_ID)}/media`,
	{
		method: 'POST',
		headers: {
			...authHeaders,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: createForm,
	},
);
if (!createResponse.ok) {
	throw new Error(
		`Instagram Reel container creation failed (${createResponse.status}): ${await createResponse.text()}`,
	);
}

const {id: containerId} = await createResponse.json();
if (typeof containerId !== 'string') {
	throw new Error('Instagram returned no Reel container ID.');
}

let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
	const statusUrl = new URL(`${graphBase}/${encodeURIComponent(containerId)}`);
	statusUrl.searchParams.set('fields', 'status_code');
	const statusResponse = await fetch(statusUrl, {headers: authHeaders});
	if (!statusResponse.ok) {
		throw new Error(
			`Instagram Reel status check failed (${statusResponse.status}): ${await statusResponse.text()}`,
		);
	}

	const {status_code: status} = await statusResponse.json();
	if (status === 'FINISHED') {
		ready = true;
		break;
	}

	if (status === 'ERROR' || status === 'EXPIRED') {
		throw new Error(`Instagram Reel container ended with status ${status}.`);
	}

	await new Promise((resolve) => setTimeout(resolve, 5000));
}

if (!ready) {
	throw new Error('Instagram Reel processing timed out after five minutes.');
}

const publishForm = new URLSearchParams({creation_id: containerId});
const publishResponse = await fetch(
	`${graphBase}/${encodeURIComponent(process.env.IG_USER_ID)}/media_publish`,
	{
		method: 'POST',
		headers: {
			...authHeaders,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: publishForm,
	},
);
if (!publishResponse.ok) {
	throw new Error(
		`Instagram Reel publishing failed (${publishResponse.status}): ${await publishResponse.text()}`,
	);
}

const published = await publishResponse.json();
console.log(
	`Published episode ${episode.episode} as Instagram media ${published.id}.`,
);
