import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const shouldPublish = process.env.SHOULD_PUBLISH === 'true';
const playlistPath = path.resolve('music/playlist.json');
const episodePath = path.resolve('out/episode.json');
const outputDirectory = path.resolve('out');
const publicMusicDirectory = path.resolve('public/music');
const episode = JSON.parse(await readFile(episodePath, 'utf8'));
const playlist = JSON.parse(await readFile(playlistPath, 'utf8'));

if (!Array.isArray(playlist.tracks)) {
	throw new Error('music/playlist.json must contain a tracks array.');
}

const tracks = playlist.tracks;
let bgmSrc = null;

if (tracks.length === 0 && shouldPublish) {
	throw new Error(
		'Publishing is blocked: add at least one approved, Instagram-cleared BGM track to music/playlist.json.',
	);
}

if (tracks.length > 0) {
	const track = tracks[(episode.episode - 1) % tracks.length];
	if (
		typeof track.file !== 'string' ||
		typeof track.title !== 'string' ||
		typeof track.sourceUrl !== 'string' ||
		typeof track.license !== 'string' ||
		typeof track.proofUrl !== 'string' ||
		track.instagramReelsAllowed !== true ||
		track.repositoryStorageAllowed !== true ||
		track.hostedDeliveryAllowed !== true ||
		track.rightsVerified !== true ||
		!Array.isArray(track.attribution)
	) {
		throw new Error(
			`BGM track at playlist index ${(episode.episode - 1) % tracks.length} is missing required rights and attribution metadata.`,
		);
	}

	const trackPath = path.resolve(track.file);
	const musicRoot = `${path.resolve('music')}${path.sep}`;
	if (!trackPath.startsWith(musicRoot)) {
		throw new Error('BGM files must be stored under the music/ directory.');
	}

	const publicFile = path.join(publicMusicDirectory, path.basename(trackPath));
	await mkdir(publicMusicDirectory, {recursive: true});
	await copyFile(trackPath, publicFile);
	bgmSrc = `music/${path.basename(trackPath)}`;

	episode.music = {
		title: track.title,
		sourceUrl: track.sourceUrl,
		license: track.license,
		proofUrl: track.proofUrl,
		attribution: track.attribution,
	};
	await writeFile(episodePath, `${JSON.stringify(episode, null, 2)}\n`);
}

await mkdir(outputDirectory, {recursive: true});
await writeFile(
	path.join(outputDirectory, 'render-props.json'),
	`${JSON.stringify({episode, bgmSrc}, null, 2)}\n`,
);
console.log(
	bgmSrc ? `Selected cleared BGM: ${episode.music.title}` : 'Preview will render without BGM.',
);
