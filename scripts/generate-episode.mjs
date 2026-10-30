import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('out');
const outputPath = path.join(outputDirectory, 'episode.json');
const startDate = process.env.EPISODE_START_DATE || '2026-10-31';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
	throw new Error('OPENAI_API_KEY is required to generate the daily episode.');
}

const dateParts = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Kolkata',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
}).formatToParts(new Date());
const datePart = (type) =>
	dateParts.find((part) => part.type === type)?.value;
const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
const start = new Date(`${startDate}T00:00:00+05:30`);
const current = new Date(`${today}T00:00:00+05:30`);
const episodeNumber =
	Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1;

if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
	throw new Error(
		`Episode date ${today} is earlier than the configured start date ${startDate}.`,
	);
}

const series =
	episodeNumber <= 20
		? 'Stories That Stay'
		: 'Love Before Likes';
const brief =
	episodeNumber <= 20
		? 'An original, emotionally grounded mother-and-son story. Keep the bond warm, respectful, and believable; do not imply that every family relationship is the same.'
		: 'An original 1990s-inspired love story using period details such as handwritten letters, landlines, cassette mixtapes, photo booths, or missed connections. Do not copy any existing film, book, song, or real person.';

const schema = {
	type: 'object',
	additionalProperties: false,
	required: [
		'episode',
		'title',
		'hook',
		'scenes',
		'caption',
		'hashtags',
		'keywords',
	],
	properties: {
		episode: {type: 'integer'},
		title: {type: 'string'},
		hook: {type: 'string'},
		scenes: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['line', 'note'],
				properties: {
					line: {type: 'string'},
					note: {type: 'string'},
				},
			},
		},
		caption: {type: 'string'},
		hashtags: {
			type: 'array',
			items: {type: 'string'},
		},
		keywords: {
			type: 'array',
			items: {type: 'string'},
		},
	},
};

const response = await fetch('https://api.openai.com/v1/chat/completions', {
	method: 'POST',
	headers: {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		model,
		temperature: 0.9,
		response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'instagram_reel_episode',
				strict: true,
				schema,
			},
		},
		messages: [
			{
				role: 'system',
				content:
					'Write original, concise, emotionally resonant vertical-video micro-stories for a global English-speaking audience. Avoid engagement bait, misleading claims, copied IP, and guaranteed-virality claims. Return only content matching the supplied JSON schema.',
			},
			{
				role: 'user',
				content: `Create episode ${episodeNumber} of the series "${series}" for ${today}. Series premise: ${brief} Create a complete story for a 40-second Reel in exactly five sequential scenes. The first scene is a compelling hook, the final scene resolves the story and gives a gentle, natural invitation to share a memory (not a demand). Each scene line should be 5-12 words, readable on a 9:16 screen; its note should be 4-12 words. Use original fictional characters, no voiceover. Caption should be concise and include one genuine question. Provide 5-8 relevant, non-spammy Instagram hashtags and 5-8 descriptive keywords. Set episode to ${episodeNumber}.`,
			},
		],
	}),
});

if (!response.ok) {
	const errorBody = await response.text();
	throw new Error(
		`OpenAI episode generation failed (${response.status}): ${errorBody}`,
	);
}

const payload = await response.json();
const content = payload.choices?.[0]?.message?.content;
if (typeof content !== 'string') {
	throw new Error('OpenAI returned no structured episode content.');
}

const generated = JSON.parse(content);
if (
	generated.episode !== episodeNumber ||
	typeof generated.title !== 'string' ||
	typeof generated.hook !== 'string' ||
	!Array.isArray(generated.scenes) ||
	generated.scenes.length !== 5 ||
	!generated.scenes.every(
		(scene) =>
			typeof scene.line === 'string' &&
			typeof scene.note === 'string' &&
			scene.line.trim().length > 0 &&
			scene.note.trim().length > 0,
	) ||
	typeof generated.caption !== 'string' ||
	!Array.isArray(generated.hashtags) ||
	!Array.isArray(generated.keywords) ||
	!generated.hashtags.every((tag) => /^#[\p{L}\p{N}_]+$/u.test(tag)) ||
	!generated.keywords.every(
		(keyword) => typeof keyword === 'string' && keyword.trim().length > 0,
	)
) {
	throw new Error('Generated episode did not pass content-shape validation.');
}

const episode = {
	series,
	date: today,
	...generated,
};

await mkdir(outputDirectory, {recursive: true});
await writeFile(outputPath, `${JSON.stringify(episode, null, 2)}\n`);
console.log(`Generated ${series} episode ${episodeNumber} for ${today}.`);
