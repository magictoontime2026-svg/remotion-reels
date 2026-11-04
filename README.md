# Stories That Stay — Reel delivery

This private repository prepares original, English-language, 9:16 illustrated
YouTube Shorts; creates a caption, hashtags, and keywords; optionally adds an
approved music track; uploads each video publicly to YouTube; and saves the
video and its details to Google Drive and Google Sheets. It does not use
voiceover. Reach and virality cannot be guaranteed.

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
3. The workflow uploads the finished video as a **public** YouTube video. Its
   vertical 40-second format qualifies for Shorts. A row is added to the
   Google Sheet with the video name, topic, caption, hashtags, SEO keywords,
   Drive link, YouTube URL and status, date, and episode number. The video is
   also saved to your Google Drive folder.
4. Re-running an episode that already has a YouTube URL in the sheet does not
   upload another public copy; it keeps the existing video and Drive file.

Without a cleared BGM track, videos render silently. Hashtags and keywords are
selected for relevance and discoverability; no tool can guarantee virality.

## One-time setup

### 1. Set up Google access

1. In Google Cloud Console, create or select a project and enable the **Google
   Drive API**, **Google Sheets API**, and **YouTube Data API v3**.
2. Configure the Google Auth Platform consent screen as an **External** app,
   add your Google account as a test user, and create an OAuth client with
   application type **Desktop app**. Download
   its JSON file. Add the YouTube upload scope
   `https://www.googleapis.com/auth/youtube.upload` to the consent screen.
   Do not commit or share the file.
3. From this repository on your computer, run:

   ```powershell
   npm ci
   npm run setup:google -- "C:\path\to\client_secret.json"
   ```

4. Open the authorization URL printed in the terminal and approve access with
   the personal Google account whose YouTube channel should publish the Shorts
   and where the videos should be saved. The setup creates or reuses a
   `Stories That Stay Reels` folder and spreadsheet, then writes the credential
   values and IDs to the ignored local file `google-oauth-secrets.json`. Keep
   it private.

The workflow uses Google OAuth authorization, not your Google password. It
requests permission to upload videos to the authorized YouTube channel, create
files for this app in Drive, and edit the spreadsheet. Uploads are public
automatically, without a review step. Google refresh tokens for OAuth apps
left in **Testing** expire after seven days. Before relying on daily
automation, review the app's publishing status and Google's verification
requirements in Google Cloud Console.

### 2. Add GitHub Actions secrets and variables

In the repository, open **Settings → Secrets and variables → Actions**.
Under **Secrets**, add:

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | An OpenAI API key with API billing enabled |
| `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` from `google-oauth-secrets.json` |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` from `google-oauth-secrets.json` |
| `GOOGLE_REFRESH_TOKEN` | `GOOGLE_REFRESH_TOKEN` from `google-oauth-secrets.json` |

If you already connected Drive using the previous version of this setup,
rerun `npm run setup:google -- "C:\path\to\client_secret.json"` to authorize
the YouTube upload scope. The existing Drive folder and spreadsheet are reused.
Replace the `GOOGLE_REFRESH_TOKEN` GitHub secret with the newly generated
value; keep the same client ID, client secret, and resource ID variables.

Under **Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_DRIVE_FOLDER_ID` | `GOOGLE_DRIVE_FOLDER_ID` from `google-oauth-secrets.json` |
| `GOOGLE_SHEET_ID` | `GOOGLE_SHEET_ID` from `google-oauth-secrets.json` |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini` |
| `EPISODE_START_DATE` | Optional India-local start date in `YYYY-MM-DD`; defaults to `2026-10-31` |

### 3. Add BGM and confirm its rights

Put each approved audio file in `music/` and add a corresponding entry to
`music/playlist.json`. Its rights metadata must include
`youtubeShortsAllowed: true`, `repositoryStorageAllowed: true`,
`driveStorageAllowed: true`, `rightsVerified: true`, source/license/proof
information, and any required caption attribution. A track's presence in a
public GitHub repository does not by itself grant usage rights. Read
`music/README.md` before adding tracks.

### 4. Test the public upload

The workflow uploads publicly as soon as the GitHub Actions run succeeds.
Before enabling it for the first time, verify the Google account/channel,
OAuth scopes, title, caption, and hashtag generation. Then open **Actions →
Daily Reel Delivery → Run workflow** to create the first public Short. The
YouTube URL, Drive link, caption, hashtags, keywords, and upload status are
recorded in the spreadsheet.

## Local checks

```powershell
npm ci
npm run generate
npm run prepare:render
npm exec -- remotion render src/index.tsx StoriesThatStay out/reel.mp4 --props out/render-props.json
```

`npm run generate` requires `OPENAI_API_KEY`; `npm run prepare:render` can
produce a silent preview with an empty playlist. `npm run deliver` requires
the Google OAuth credentials and Drive/Sheet IDs described above.
