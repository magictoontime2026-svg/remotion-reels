# Stories That Stay — Reel automation

This private repository prepares original, English-language, 9:16 illustrated
Reels; creates a caption, hashtags, and keywords; optionally adds an approved
music track; and can publish through the Instagram Graph API. It does not use
voiceover. Reach and virality cannot be guaranteed.

The GitHub Actions workflow runs at **7:00 PM India Standard Time** (13:30 UTC).
GitHub scheduled jobs can start late. Scheduled publishing remains off until
the repository variables `AUTO_PUBLISH_ENABLED` and `PILOT_APPROVED` are both
set to `true`. A manual preview does not publish. A manual publish also requires
`PILOT_APPROVED=true`.

## What runs each day

1. OpenAI writes a new five-scene fictional story and post copy, using an
   episode number derived from the India calendar date. Episodes 1–20 are
   mother-and-son stories; later episodes are original 1990s-inspired love
   stories.
2. The workflow selects an approved BGM track from `music/playlist.json`,
   renders a 40-second 1080×1920 H.264 MP4, and saves the Reel and episode JSON
   as a GitHub Actions artifact.
3. If publishing is explicitly enabled, the runner uploads the video to a
   publicly readable R2 URL, waits for Instagram to finish processing, and
   publishes the Reel with the generated caption and hashtags.

Without a cleared BGM track, preview runs are silent; a publishing run is
blocked. A public video URL is needed because Instagram fetches the media from
the host. Keep Instagram tokens, Cloudflare credentials, and OpenAI keys in
GitHub Actions secrets, never in the repository or generated artifacts.

## One-time setup

### 1. Add GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions → New
repository secret** and add:

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | An OpenAI API key with API billing enabled |
| `IG_USER_ID` | Instagram Professional account ID for Graph API publishing |
| `IG_ACCESS_TOKEN` | Meta access token with the required Instagram publishing permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID that owns the R2 bucket |
| `R2_BUCKET` | R2 bucket name |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key ID |
| `R2_SECRET_ACCESS_KEY` | Matching R2 S3-compatible secret |

Use the official Meta Instagram API setup for a Professional (Creator or
Business) account linked to a Facebook Page. Meta permissions, app review,
token lifetime, and account eligibility are controlled by Meta. Set the
`META_GRAPH_API_VERSION` Actions variable to a currently supported version.

### 2. Add GitHub Actions variables

Open **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Value |
|---|---|
| `META_GRAPH_API_VERSION` | Current supported Graph API version, such as `vNN.N` |
| `R2_PUBLIC_BASE_URL` | HTTPS base URL for the public R2 custom domain or public bucket URL |
| `AUTO_PUBLISH_ENABLED` | Leave unset or `false` until the pilot is approved |
| `PILOT_APPROVED` | Leave unset or `false` until you approve the rendered pilot |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini` |
| `EPISODE_START_DATE` | Optional India-local start date in `YYYY-MM-DD`; defaults to `2026-10-31` |

Configure R2 so the uploaded objects can be fetched via
`R2_PUBLIC_BASE_URL`. Do not expose the S3 access key in the public URL.

### 3. Add BGM and confirm its rights

Put each approved audio file in `music/` and add a corresponding entry to
`music/playlist.json`. The manifest must record `file`, `title`, `sourceUrl`,
`license`, `proofUrl`, `instagramReelsAllowed: true`,
`repositoryStorageAllowed: true`, `hostedDeliveryAllowed: true`,
`rightsVerified: true`, and `attribution` (an array; use an empty array if none
is required). The rights must cover Instagram use, storage in GitHub, and
delivery from R2. The publisher appends required attribution to the Instagram
caption. A track's presence in a public GitHub repository does not by itself
grant usage rights. Read `music/README.md` before adding tracks.

### 4. Preview, review, then enable publishing

1. Open **Actions → Daily Instagram Reel → Run workflow** and leave
   **Publish to Instagram** unchecked.
2. Download the `reel-<run id>` artifact and review the MP4, episode, caption,
   hashtags, keywords, and BGM rights.
3. Only after approving the pilot, set `PILOT_APPROVED=true`. Then configure
   and test the Meta and R2 setup with a deliberate manual publish.
4. Enable daily posting by setting `AUTO_PUBLISH_ENABLED=true`.

To pause scheduled publishing, unset `AUTO_PUBLISH_ENABLED` or change it to
`false`. A manual workflow run can still produce a preview. Do not enable the
schedule until credentials, a cleared BGM track, public R2 access, and Meta
publishing access have all been tested.

## Local checks

```powershell
npm ci
npm run generate
npm run prepare:render
npx remotion render src/index.tsx StoriesThatStay out/reel.mp4 --props out/render-props.json
```

`npm run generate` requires `OPENAI_API_KEY`; `npm run prepare:render` can
produce a silent preview with an empty playlist. Instagram
publishing is performed only by the explicit GitHub Actions publish path.
