import {Audio} from '@remotion/media';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	staticFile,
	useCurrentFrame,
} from 'remotion';

type StoryScene = {
	line: string;
	note: string;
};

type Episode = {
	series: string;
	episode: number;
	title: string;
	hook: string;
	scenes: StoryScene[];
	caption: string;
	hashtags: string[];
	keywords: string[];
};

export type ReelProps = {
	episode: Episode;
	bgmSrc: string | null;
};

const framesPerScene = 240;

export const Reel: React.FC<ReelProps> = ({episode, bgmSrc}) => {
	const frame = useCurrentFrame();
	const sceneIndex = Math.min(
		episode.scenes.length - 1,
		Math.floor(frame / framesPerScene),
	);
	const sceneFrame = frame - sceneIndex * framesPerScene;
	const scene = episode.scenes[sceneIndex];
	const opacity = interpolate(
		sceneFrame,
		[0, 20, 220, framesPerScene],
		[0, 1, 1, 0],
		{
			easing: Easing.bezier(0.16, 1, 0.3, 1),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		},
	);
	const rise = interpolate(sceneFrame, [0, 28], [28, 0], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				background: 'linear-gradient(180deg, #fff5eb, #f3d9cd)',
				color: '#593b35',
				fontFamily: 'Georgia, serif',
				alignItems: 'center',
				overflow: 'hidden',
			}}
		>
			{bgmSrc ? (
				<Audio src={staticFile(bgmSrc)} volume={0.14} loop />
			) : null}
			<div
				style={{
					position: 'absolute',
					inset: 38,
					border: '1px solid rgba(89, 59, 53, 0.18)',
					borderRadius: 28,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					top: 140,
					fontFamily: 'Arial, sans-serif',
					fontSize: 24,
					fontWeight: 700,
					letterSpacing: 7,
					opacity: 0.72,
				}}
			>
				{episode.series.toUpperCase()} · EP. {String(episode.episode).padStart(2, '0')}
			</div>
			<div
				style={{
					position: 'absolute',
					top: 230,
					width: 900,
					textAlign: 'center',
					fontSize: 68,
					fontWeight: 700,
					letterSpacing: -2,
				}}
			>
				{episode.title}
			</div>
			<svg
				viewBox="0 0 800 560"
				style={{
					position: 'absolute',
					width: 900,
					height: 630,
					top: 370,
					opacity,
					transform: `translateY(${rise}px)`,
				}}
			>
				<ellipse
					cx="400"
					cy="485"
					rx="270"
					ry="25"
					fill="#9c6555"
					opacity="0.14"
				/>
				<circle cx="400" cy="265" r="205" fill="#fffaf4" opacity="0.52" />
				<path
					d="M187 461 Q253 413 323 461 M477 461 Q547 413 613 461"
					fill="none"
					stroke="#a97161"
					strokeWidth="7"
					strokeLinecap="round"
					opacity="0.5"
				/>
				<rect
					x="570"
					y="116"
					width="88"
					height="118"
					rx="10"
					fill="#a66c5a"
					opacity="0.82"
				/>
				<rect
					x="582"
					y="129"
					width="64"
					height="91"
					rx="5"
					fill={sceneIndex === 1 ? '#ffd78c' : '#f6c982'}
					opacity={sceneIndex === 1 ? 1 : 0.68}
				/>
				<path
					d="M614 88v27 M597 104l17 12 17-12"
					fill="none"
					stroke="#9a6656"
					strokeWidth="8"
					strokeLinecap="round"
					strokeLinejoin="round"
					opacity="0.75"
				/>
				<g>
					<path
						d="M244 456 Q241 373 258 323 Q284 293 329 308 Q364 326 371 456Z"
						fill="#b66d61"
					/>
					<path
						d="M257 344 Q228 300 247 240 Q258 181 315 179 Q373 186 372 248 Q378 292 342 331Z"
						fill="#493632"
					/>
					<ellipse cx="310" cy="255" rx="55" ry="66" fill="#d99c7f" />
					<path
						d="M259 238 Q266 183 316 184 Q366 190 369 242 Q340 211 303 215 Q280 216 259 238Z"
						fill="#493632"
					/>
					<path
						d="M276 253h3 M337 253h3"
						stroke="#493632"
						strokeWidth="7"
						strokeLinecap="round"
					/>
					<path
						d="M299 278 Q311 288 324 278"
						fill="none"
						stroke="#9e554c"
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<path
						d="M257 347 Q224 381 233 421 M350 348 Q382 373 396 404"
						fill="none"
						stroke="#d99c7f"
						strokeWidth="19"
						strokeLinecap="round"
					/>
					<path
						d="M259 452h42 M326 452h39"
						stroke="#68463e"
						strokeWidth="13"
						strokeLinecap="round"
					/>
				</g>
				<g>
					<path
						d="M414 456 Q416 365 433 330 Q454 310 488 321 Q516 340 522 456Z"
						fill="#668c83"
					/>
					<ellipse cx="467" cy="267" rx="45" ry="54" fill="#e2ad87" />
					<path
						d="M422 255 Q424 208 466 210 Q508 213 511 253 Q492 228 464 231 Q442 230 422 255Z"
						fill="#60463b"
					/>
					<path
						d="M446 267h2 M484 267h2"
						stroke="#60463b"
						strokeWidth="6"
						strokeLinecap="round"
					/>
					<path
						d="M457 286 Q467 295 477 286"
						fill="none"
						stroke="#a95e50"
						strokeWidth="4"
						strokeLinecap="round"
					/>
					<path
						d="M432 347 Q407 372 396 403 M510 348 Q531 377 523 410"
						fill="none"
						stroke="#e2ad87"
						strokeWidth="17"
						strokeLinecap="round"
					/>
					<path
						d="M431 452h34 M479 452h32"
						stroke="#68463e"
						strokeWidth="12"
						strokeLinecap="round"
					/>
				</g>
				<g
					transform={`translate(397 355) scale(${interpolate(sceneFrame, [0, 25, 45], [0.6, 1.15, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					})})`}
					style={{transformOrigin: '0px 0px'}}
					opacity={sceneIndex === 2 ? 0.2 : 0.88}
				>
					<path
						d="M0 13 C-30 -8 -20 -34 0 -19 C20 -34 30 -8 0 13Z"
						fill="#cf7768"
					/>
				</g>
				<g fill="#c78968" opacity="0.68">
					<path d="M177 246l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" />
					<path d="M610 290l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
					<circle cx="208" cy="345" r="5" />
					<circle cx="588" cy="275" r="6" />
				</g>
			</svg>
			<div
				style={{
					position: 'absolute',
					top: 1110,
					width: 900,
					minHeight: 360,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					textAlign: 'center',
					opacity,
					transform: `translateY(${rise}px)`,
					flexDirection: 'column',
				}}
			>
				<div
					style={{
						fontSize: sceneIndex === 4 ? 47 : 54,
						fontWeight: 700,
						lineHeight: 1.22,
						letterSpacing: -1.2,
					}}
				>
					{scene.line}
				</div>
				<div
					style={{
						marginTop: 22,
						fontFamily: 'Arial, sans-serif',
						fontSize: 28,
						lineHeight: 1.4,
						letterSpacing: 0.3,
						opacity: 0.78,
					}}
				>
					{scene.note}
				</div>
			</div>
			<div
				style={{
					position: 'absolute',
					bottom: 160,
					display: 'flex',
					gap: 12,
				}}
			>
				{episode.scenes.map((item, index) => (
					<div
						key={item.line}
						style={{
							width: index === sceneIndex ? 32 : 9,
							height: 9,
							borderRadius: 9,
							backgroundColor: '#80594f',
							opacity: index === sceneIndex ? 0.85 : 0.3,
						}}
					/>
				))}
			</div>
		</AbsoluteFill>
	);
};
