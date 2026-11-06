# Breath Journey · Light School

A guided breathwork meditation in nine cycles, with your own Spotify music changing on every exhale.

The flow follows a breathwork teacher's blueprint for an eight or nine cycle journey:

- **Prepare**: welcome, safety check, learn the breath (three practice breaths and a practice hold), what you might feel, what opens up, and a warm-up breath while you set your question.
- **Nine cycles**, each with its own focus, guidance, timing and music: arrive in the body, honour the body, inner fire, open the heart, return to your question, deepen the connection, inspired action, this is happening, the peak.
- **Every cycle** runs: rhythmic breathing → breathe all the way out and **hold** (stay longer or breathe in sooner) → big breath in → **hold at the top** with a 4, 3, 2, 1 count → release.
- **Music**: the next cycle's track starts on the release breath, after the volume steps down on 4, 3, 2, 1.
- **Guidance around your theme** (on/off): set a theme such as "my dream company" and each cycle weaves in questions shaped like the blueprint's own: the body in cycle 2, resistance in 3, feeling in 4, letting go of the stories in 5, inspired action in 7, the dream and legacy in 8.
- **Voice**: guidance spoken in an ElevenLabs voice (pre-generated audio, plus theme lines voiced on demand by a server function), with the browser's voice as a fallback.
- **One song per cycle**: when you scrub or jump between cycles, the song picks up at the matching moment.
- **Breath map**: a timeline of the whole journey (and a zoomable view of each cycle) showing breathing, holds on empty, holds at the top and where the track changes. During a session, drag the timeline to scrub to any moment: breath, guidance and music all follow.
- **Integration**: rest, then capture what came through and your next true step in a private journal.

## Run it

```bash
npm install
cp .env.example .env   # then add your own Spotify Client ID (see below)
npm run dev            # http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173**, not `localhost`. Spotify only accepts loopback IP addresses for local sign-in.

Other scripts: `npm test` (session engine tests), `npm run build`, `npm run lint`.

## Spotify: bring your own key

Everyone who runs this app needs **their own** Spotify developer app. Never share or commit keys.

1. Go to the **[Spotify Developer Dashboard](https://developer.spotify.com/dashboard)** and choose **Create app**.
2. Add the Redirect URI **`http://127.0.0.1:5173/callback`** (for a deployed copy, add `https://your-domain/callback` too).
3. Under "Which API/SDKs are you planning to use", tick **Web API** and **Web Playback SDK**. Save.
4. In **User Management**, add the Spotify account email of every person who will sign in. Development Mode apps allow up to 5 users, and the app owner needs Spotify Premium.
5. Copy the **Client ID** into `.env` as `VITE_SPOTIFY_CLIENT_ID=...`, or paste it into the app on the Music page. It is then stored in your browser.

No client secret is needed. Sign-in uses the Authorization Code flow with PKCE, entirely in the browser. If you keep a secret in `.env` for other tools, never prefix it with `VITE_`, because Vite would bundle it into the public JavaScript.

### Where the music plays

- **This browser** (desktop Chrome, Edge, Firefox or Safari) through the Spotify Web Playback SDK. Requires Spotify **Premium**.
- **Any Spotify Connect device**: the Spotify app on your phone or computer, or a speaker. Open Spotify there, play anything for a second, then choose it under "Music plays on". Use this without Premium in the browser, or on mobile, where the Web Playback SDK does not run.

### Choosing tracks

On the **Music** page, each cycle (plus arrival and the closing rest) has a slot showing the blueprint's mood and tempo. Add tracks by:

- **From the blueprint**: the handout's suggested tracks, one tap to search Spotify
- **Search**
- **My playlists**: Spotify only shares the contents of playlists you own or collaborate on
- **Paste a link**: Share → Copy Song Link in Spotify

Set a **start at** time per track to skip a long intro. If a slot is empty, the previous music carries on. During a session, open the music drawer (♫ or `M`) to set what plays **up next** or to **play now**.

## ElevenLabs voice (optional)

Without this, the browser's built-in voice speaks the guidance. To use an ElevenLabs voice, bring your own key:

1. Create an API key at **[elevenlabs.io/app/developers/api-keys](https://elevenlabs.io/app/developers/api-keys)**. Give it Text to Speech access.
2. Add it to `.env` as `ELEVENLABS_API_KEY=...`. **Never** prefix it with `VITE_`, because that would publish it in the browser bundle. Optionally set `ELEVENLABS_VOICE_ID` (the default is "River", a calm premade voice).
3. Run `npm run voice` to pre-generate every fixed guidance line into `public/voice` (about 4,300 characters; `npm run voice -- --dry` shows the cost first). Re-running only generates new or changed lines.

Theme guidance includes your theme, so it can't be pre-generated. `/api/tts` voices it on demand (a Vercel function in production, Vite middleware in development). It only accepts the fixed theme templates, never arbitrary text, and the browser caches each line so it is generated once. The ElevenLabs free tier allows 10,000 characters a month and requires crediting ElevenLabs.

## Deploy to Vercel

```bash
vercel link
vercel env add VITE_SPOTIFY_CLIENT_ID      # your Spotify Client ID (public by design)
vercel env add ELEVENLABS_API_KEY          # optional, server-only
vercel --prod
```

Then add `https://<your-domain>/callback` as a Redirect URI in your Spotify app. `.vercelignore` keeps `.env` and `research/` from being uploaded.

## Fonts

The Light School typeface, Gilroy, is licensed and **not included** in this repository. Without it the app uses Inter (included, SIL Open Font License). If you hold a Gilroy licence, put `gilroy-light.woff2`, `gilroy-regular.woff2`, `gilroy-medium.woff2` and `gilroy-bold.woff2` in `public/fonts/`.

## Keyboard (during a session)

| Key | Action |
| --- | --- |
| Space | Pause / resume |
| ← → on the timeline | Scrub 5 s (Shift: 30 s) |
| L | Stay longer in the hold (+15 s) |
| Enter or → | Next step (in the hold: breathe in now) |
| M | Music drawer |

## Project layout

```
src/data/blueprint.ts     the nine cycles: timings, guidance, music direction, suggested tracks
src/engine/session.ts     pure state machine for the session (tested in session.test.ts)
src/engine/simulate.ts    runs the engine over the plan to draw the breath map
src/engine/useSession.ts  drives the engine with requestAnimationFrame and a background-safe interval
src/data/themeGuidance.ts questions woven around your theme, per cycle
src/spotify/              PKCE auth, Web API client, playback (SDK + Connect), music director
server/tts.ts, api/tts.ts ElevenLabs voice on the server (key never reaches the browser)
scripts/generate-voice.ts pre-generates the fixed guidance audio into public/voice
src/audio/                synthesised chimes and breath tones, spoken guidance
src/views/                Home, Prepare, Session, Music, Integrate / Journal
research/                 local only, never committed
```

## Safety

This is a powerful breathwork practice. It is not recommended with pregnancy, epilepsy, high blood pressure, cardiovascular disease, high inner eye pressure, clinical anxiety or panic attacks, psychosis, a history of stroke, or recent surgery. Never practise in water, while driving, or anywhere fainting could be unsafe.
