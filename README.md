# Stories That Stay — Reel delivery

This private repository prepares original, English-language, 9:16 illustrated
Reels; creates a caption, hashtags, and keywords; optionally adds an approved
music track; and saves the video and its details to Google Drive and Google
Sheets for manual Instagram upload. It does not use voiceover. Reach and
virality cannot be guaranteed.

The GitHub Actions workflow runs daily at **7:00 PM India Standard Time**
(13:30 UTC). GitHub scheduled jobs can start late. You can also start a run
manually from the Actions tab.

## What runs each day

1. OpenAI writes a new five-scene fictional story and post copy, using an
   episode number derived from the India calendar date. Episodes 1–20 are
   mother-and-son stories; later episodes are original 1990s-inspired love
   stories.
2. The workflow selects an approved BGM track from `music/playlist.json`,
   renders a 40-second 1080×1920 H.264 MP4, and saves the Reel and episode JSON
   as a GitHub Actions artifact.
3. The video is uploaded to your Google Drive folder. A row is added to the
   Google Sheet with the video name, topic, caption, hashtags, SEO keywords,
   Drive link, date, and episode number. Re-running the same episode updates
   its existing Drive file and spreadsheet row rather than adding duplicates.

Without a cleared BGM track, videos render silently. Hashtags and keywords are
selected for relevance and discoverability; no tool can guarantee virality.

## One-time setup

### 1. Set up Google access

1. In Google Cloud Console, create or select a project and enable the **Google
   Drive API** and **Google Sheets API**.
2. Configure the Google Auth Platform consent screen for your Google account
   and create an OAuth client with application type **Desktop app**. Download
   its JSON file. Do not commit or share the file.
3. From this repository on your computer, run:

   ```powershell
   npm ci
   npm run setup:google -- "C:\path\to\client_secret.json"
   ```

4. Open the authorization URL printed in the terminal and approve access with
   the personal Google account where you want the videos saved. The setup
   creates a `Stories That Stay Reels` folder and spreadsheet, then writes the
   credential values and IDs to the ignored local file
   `google-oauth-secrets.json`. Keep it private.

The workflow uses your Google OAuth authorization, not your Google password.
The scope is limited to files created by this app and spreadsheet access.
Google refresh tokens for OAuth apps left in **Testing** expire after seven
days. Before relying on daily automation, review the app's publishing status
and Google's verification requirements in Google Cloud Console.

### 2. Add GitHub Actions secrets and variables

In the repository, open **Settings → Secrets and variables → Actions**.
Under **Secrets**, add:

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | An OpenAI API key with API billing enabled |
| `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` from `google-oauth-secrets.json` |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` from `google-oauth-secrets.json` |
| `GOOGLE_REFRESH_TOKEN` | `GOOGLE_REFRESH_TOKEN` from `google-oauth-secrets.json` |

Under **Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_DRIVE_FOLDER_ID` | `GOOGLE_DRIVE_FOLDER_ID` from `google-oauth-secrets.json` |
| `GOOGLE_SHEET_ID` | `GOOGLE_SHEET_ID` from `google-oauth-secrets.json` |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini` |
| `EPISODE_START_DATE` | Optional India-local start date in `YYYY-MM-DD`; defaults to `2026-10-31` |

### 3. Add BGM and confirm its rights

Put each approved audio file in `music/` and add a corresponding entry to
`music/playlist.json`. The manifest must record `file`, `title`, `sourceUrl`,
`license`, `proofUrl`, `instagramReelsAllowed: true`,
`repositoryStorageAllowed: true`, `hostedDeliveryAllowed: true`,
`rightsVerified: true`, and `attribution` (an array; use an empty array if none
is required). The rights must cover Instagram use, storage in GitHub, and
delivery from Google Drive. A track's presence in a public GitHub repository
does not by itself grant usage rights. Read `music/README.md` before adding
tracks.

### 4. Generate and manually upload

Open **Actions → Daily Reel Delivery** to run it manually or review the daily
run. Each successful run uploads the video and its metadata to Drive and
updates the spreadsheet. Open the Drive link in the sheet, download the MP4,
and upload it to Instagram yourself using the caption and hashtags from the
same row.

## Local checks

```powershell
npm ci
npm run generate
npm run prepare:render
npm exec -- remotion render src/index.tsx StoriesThatStay out/reel.mp4 --props out/render-props.json
```

`npm run generate` requires `OPENAI_API_KEY`; `npm run prepare:render` can
produce a silent preview with an empty playlist. `npm run deliver` requires
the Google service-account JSON and Drive/Sheet IDs described above.
