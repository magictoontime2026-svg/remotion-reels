import type React from 'react';
import {Composition} from 'remotion';
import {Reel, type ReelProps} from './Reel';

const defaultProps: ReelProps = {
	episode: {
		series: 'Stories That Stay',
		episode: 1,
		title: 'The Porch Light',
		hook: 'At 17, he said, “Don’t wait up, Mom.”',
		scenes: [
			{
				line: 'At 17, he said, “Don’t wait up, Mom.”',
				note: 'The words sounded grown-up. The silence afterward didn’t.',
			},
			{
				line: 'Still, the porch light came on every night.',
				note: 'Some kinds of love never ask for applause.',
			},
			{
				line: 'Years later, he came home with a broken heart.',
				note: 'He didn’t have to explain a thing.',
			},
			{
				line: 'She made his tea. Then left a note.',
				note: '“You never have to earn your way back home.”',
			},
			{
				line: 'Somewhere, someone is still leaving the light on for you.',
				note: 'Send this to the person who feels like home.',
			},
		],
		caption:
			'He thought growing up meant needing her less. Years later, he learned home was the one place he never had to prove he belonged. 🤍\n\nEpisode 1 of Stories That Stay.\n\nWho leaves the light on for you?',
		hashtags: [
			'#MotherAndSon',
			'#FamilyLove',
			'#HeartwarmingStory',
			'#ShortStory',
			'#StoriesThatStay',
		],
		keywords: [
			'mother and son story',
			'family love',
			'emotional short story',
			'mother son bond',
			'heartwarming story',
		],
	},
	bgmSrc: null,
};

export const RemotionRoot: React.FC = () => (
	<Composition
		id="StoriesThatStay"
		component={Reel}
		width={1080}
		height={1920}
		fps={30}
		durationInFrames={1200}
		defaultProps={defaultProps}
	/>
);
