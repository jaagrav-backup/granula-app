# Granula

A local-first desktop meeting notetaker. Granula captures both sides of a
conversation — your microphone and your computer's system audio — transcribes
them live, and turns the transcript into clean, skimmable AI notes. Everything
stays on your machine as plain JSON you can read, edit, back up, or sync
however you like.

Built on Electron + React. Audio capture is powered by the
[`notetaker-sdk`](https://www.npmjs.com/package/notetaker-sdk), which handles
dual-source mic + system audio recording and streams it to Deepgram for
transcription. Gemini handles note generation.

## Features

- **Dual-source live transcription.** Records mic and system audio in
  parallel via the `notetaker-sdk` and streams them to Deepgram for real-time
  interim + final transcripts.
- **AI meeting notes.** On stop (or on demand) the transcript is sent to
  Gemini 2.5 Flash and streamed back into the UI token-by-token. Notes are
  rendered as markdown with summary, key points, notable details, action
  items, and follow-ups.
- **Scratchpad with markdown preview.** Jot raw notes in markdown, toggle to
  preview, and it gets folded into the AI notes as extra context.
- **Global recording indicator.** Navigate between pages freely — a sidebar
  pill shows what's being recorded and a live timer, and clicking it jumps
  back to the meeting.
- **Light & dark mode.** Theme toggle in the title bar, Tailwind v4
  `@custom-variant` dark styling throughout.
- **Custom frameless window** with macOS traffic lights preserved and a
  draggable title bar.
- **Fully local storage, human-readable.** Everything lives in
  `~/Documents/Granula` as plain JSON — no hidden database, no cloud.
- **Live file watching.** Edit any `meeting.json` in a text editor and the
  app picks up your changes instantly.

## Your data folder

```
~/Documents/Granula/
├── keys.json                         # Deepgram + Gemini API keys
└── meetings/
    └── m_<timestamp>_<rand>/
        └── meeting.json              # title, createdAt, durationMs, status,
                                      # transcript, scratchpad, aiNotes
```

One file per meeting, one folder for the whole app. Delete a meeting folder
to delete the meeting. Open `keys.json` in any editor to update your keys.

## Setup

```bash
npm install
npm run dev        # Vite renderer + Electron in dev
npm run build      # Production renderer build
npm run dist       # Packaged app (via electron-builder)
```

Then open **Settings** and paste in:

- A **Deepgram** API key (used for streaming transcription — `nova-3` model).
- A **Gemini** API key (used for `gemini-2.5-flash`).

Or edit `~/Documents/Granula/keys.json` directly.

## Keyboard & menu

- **⌘⇧O** / **Ctrl+Shift+O** — Open the Granula folder in Finder/Explorer.

## Auto updates

Granula uses [`electron-updater`](https://www.electron.build/auto-update)
with GitHub Releases as the update feed. On launch the app checks for a
newer version, downloads it in the background, and shows a **Restart &
install** prompt in the sidebar when it's ready.

### Publishing a release

1. Bump the version in `package.json` (e.g. `1.0.1` → `1.0.2`).
2. Commit and push.
3. Tag the commit and push the tag:

   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```

4. The `.github/workflows/release.yml` GitHub Action runs on `macos-latest`,
   builds the app, and publishes the artifacts (`.dmg`, `.zip`, `latest-mac.yml`)
   to a new GitHub Release using the default `GITHUB_TOKEN`.

To publish manually from your machine instead:

```bash
export GH_TOKEN=<github-personal-access-token>
npm run release
```

The updater reads the `publish` block in `package.json`, which points at
`github.com/jaagrav-backup/granula-app`. Change the `owner`/`repo` fields if
you fork.

## Tech stack

Electron 41 · React 19 · Vite 8 · Tailwind CSS v4 · React Router ·
shadcn-style UI primitives · Phosphor Icons · notetaker-sdk · Deepgram ·
Gemini REST streaming API.
