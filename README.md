# 🎬 AnimateX - 2D Animation Studio

A mobile-first 2D cartoon animation studio built with Next.js and Firebase.

## Features

### Public Access
- 🌐 Public homepage with features overview
- 📋 Browse templates without login
- 🎥 Demo and preview sections

### Authentication Required
- ✏️ Create and edit animations
- 💾 Save projects to cloud
- 📤 Export videos
- 🎙️ Voice recording

### Authentication
- 📧 Email/Password signup and login
- 🔑 Google Sign-In
- 🔒 Password reset
- 🔐 Secure session management

### Animation Features
- 🎨 Canvas-based 2D editor
- ⏱️ CapCut-style timeline
- 🎭 Built-in characters and expressions
- 🏞️ Backgrounds and props library
- 📝 Bangla/English text support
- 🎙️ Voice recording with lip sync
- ✨ AI story-to-scene generation
- 📤 Video export (WebM)

### Project Management
- 📂 Private project workspace
- 💾 Auto-save with offline support
- 📋 Duplicate, rename, delete projects
- 🔄 Version history

### Admin Panel
- 📊 Dashboard with statistics
- 👥 User management
- ⚙️ Feature flags
- 📢 Announcements

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  Next.js + React + TypeScript + Tailwind CSS    │
│  PWA with Service Worker                        │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                   FIREBASE                       │
│  Auth (Email + Google) │ Firestore │ Storage   │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              LOCAL (IndexedDB)                   │
│  Offline drafts, cache, recovery data           │
└─────────────────────────────────────────────────┘
```

## Security

### User Data Isolation
- Users can ONLY access their own projects
- Firebase Security Rules enforce ownership
- No cross-user data access possible

### Admin Access
- Admin status via Firebase Custom Claims
- Server-side verification required
- Admins CANNOT see user passwords
- Activity logging for accountability

### Password Handling
- Firebase Authentication handles passwords
- No plaintext passwords stored
- Secure password reset flow

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Authentication** (Email/Password + Google providers)
3. Create **Firestore Database**
4. Enable **Cloud Storage**
5. Register a Web App

### 3. Environment Variables

Create `.env` with your Firebase config:

```env
# Client-side Firebase (safe for browser)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-side Firebase Admin (KEEP SECRET)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Admin Setup
ADMIN_SETUP_KEY=your_secure_random_key
```

### 4. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 5. Run Development Server

```bash
npm run dev
```

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/templates` | Public | Browse templates |
| `/auth/login` | Public | Sign in |
| `/auth/signup` | Public | Create account |
| `/auth/forgot-password` | Public | Reset password |
| `/studio` | Auth Required | Project dashboard |
| `/editor/[id]` | Auth Required | Animation editor |
| `/admin` | Admin Only | Admin panel |

## Vercel Deployment

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel Dashboard
3. Deploy

## Admin Setup

To create the first admin:

```bash
curl -X POST https://your-domain.com/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "setupKey": "your_setup_key"}'
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State:** Zustand
- **Local Storage:** IndexedDB (idb)
- **PWA:** Service Worker, Web App Manifest

## License

MIT

---

## 🆕 Editor Update (2026-08)

Professional editor overhaul — the canvas, timeline and export now actually do what the UI promises.

### What was fixed / added

1. **Interactive resize handles** — select any object and drag the corner handles to scale (aspect ratio locked), the edge handles for one-axis scaling, or the round handle above to rotate. Works with mouse AND touch.
2. **Scale & Rotate tools** — the toolbar tools now work: select `📐 Scale` and drag to scale from the center, select `🔄 Rotate` and drag to spin around the center.
3. **Distinct characters** — every character type (boy, girl, child, man, woman, old-man, old-woman, dog, cat, bird, cow, goat) now has its own shape, colors, hair, glasses, ears, horns etc. No more identical stick figures.
4. **Action animations** — idle, walk, run, jump, sit, stand, wave, talk, point, clap, cry, laugh, dance, fall all animate limbs via `requestAnimationFrame`; press play in the timeline to see them move. Expressions render on the face (happy, sad, angry, scared, surprised, laughing, crying, thinking, sleepy…).
5. **Expressions & Actions are real buttons** — select an object, open the Assets panel and click an expression or action to apply it instantly (active state is highlighted).
6. **Custom uploads (Cloudinary)** — `+ Upload Custom Character/Background/Prop` now actually uploads the file to `/api/upload`, saves the returned URL on the canvas object, and the canvas draws the real image (`drawImage`). Uploaded assets are remembered in "My Characters/Backgrounds/Props".
7. **Objects are scene-scoped** — each scene now keeps its own objects; switching scenes no longer mixes elements.
8. **Drafts are restored on refresh** — objects no longer disappear when you reload the editor.
9. **Undo/Redo covers canvas edits** — moves, resizes, rotations, additions and deletions can all be undone (Ctrl+Z / Ctrl+Shift+Z).
10. **Timeline ↔ canvas selection sync** — clicking a clip selects its object; clips show readable names and can be deleted.
11. **Professional export** — exports render the real characters, animations, images and text (not colored rectangles), scene by scene, at the project's aspect ratio.
12. **Toolbar properties** — X / Y / W / H / rotation / opacity inputs for the selected object, plus bring-forward / send-backward layers.
13. **Audio upload** — upload MP3/WAV/M4A/OGG in the Assets → Audio tab (added to the Voice track).
14. **Keyboard** — arrow keys nudge the selected object (Shift = 1px), Delete removes it, Space plays/pauses, Ctrl+Z undo.

### Setup notes

- **Cloudinary (required for custom uploads):** add these to your Vercel project / `.env`:
  ```
  CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...
  ```
  Without them the upload buttons show a friendly error instead of crashing.
- TypeScript strict typechecking (`npm run typecheck`) and ESLint (`npm run lint`) pass clean.

---

## 🆕 Premium Update #2 (2026-08)

Another round of professional upgrades + bug fixes:

### Bug fixes
1. **Voice recording now actually gets added** — previously the recording was uploaded to Firebase Storage *before* being added to the timeline, so when storage wasn't configured the clip silently vanished. Now it's **local-first**: the recording is saved to IndexedDB, added to the Voice track instantly, and stays playable offline.
2. **Audio playback in the timeline** — pressing play now actually plays voice/music clips in sync with the timeline (hidden audio engine).
3. **Save reliability on phones** — pressing Back now waits for the save to finish, saving also triggers when you switch apps (visibilitychange), and a manual 💾 Save button was added to the toolbar. No more lost projects on mobile.
4. **Infinite autosave loop** prevented (saving no longer re-triggers autosave).

### New premium features
5. **💧 Watermark** — a small "AnimateX Studio" badge appears in the corner of the canvas preview and in every export. Toggle it and change the text inside the Export dialog.
6. **🖼️ GIF export** — export your animation as a GIF that plays everywhere, including iOS/Android photo galleries (WebM doesn't work on iOS). A tiny built-in GIF encoder is used — no extra dependencies.
7. **📸 PNG frame export** — export the current frame as a high-res PNG.
8. **🎬 Motion presets** — select an object and pick a Motion (Fade In/Out, Slide, Pop In, Bounce, Zoom In, Spin In) from the toolbar; it animates when you press play. Applied in exports too.
9. **↔️↕️ Align/Center buttons** — one-tap center horizontally / vertically.
10. **⧉ Duplicate object** — button or Ctrl+D.
11. **✏️ Edit text on canvas** — double-click a text object (or press the Edit Text button) to change text, size, color and bold.
12. **🎨 Scene settings** — per-scene background color picker and duration control in the Scenes panel.
13. **Manual Save button** — 💾 in the toolbar.

### Export formats now
- **WebM video** (best quality, desktop) — real characters/actions/images/text/watermark
- **GIF** (universal, mobile gallery friendly)
- **PNG** (current frame snapshot)

---

## 🆕 Premium Update #3 — The Big Free Feature Pack (2026-08)

Eight professional features — all built in-house, zero paid APIs:

1. **◆ Keyframe animation** — select an object, press `◆ Keyframe` in the toolbar or timeline at any playhead position, and move/scale/rotate the object later. Playback interpolates between keyframes with easing (linear / ease-in / ease-out / ease-in-out). Keyframes show as yellow diamonds on timeline clips. Works in export too.
2. **▶️ Play all scenes** — the timeline now plays the entire scene sequence in a loop (not just the current scene), advancing scenes automatically.
3. **🎬 Scene transitions** — fade / crossfade / slide / zoom between scenes, live in the editor and baked into video/GIF exports.
4. **🖱️ Multi-select** — Shift/Ctrl-tap objects to select several at once, drag to move them together, delete or align as a group.
5. **✒️ Text outline & shadow** — select a text object and use the Outline / Shadow color + width/blur sliders in the toolbar.
6. **🖼️ Auto thumbnails** — project cards now show a real preview image of your first scene (auto-generated on save).
7. **✨ Smart Story Generator (offline)** — type a Bangla/English sentence (e.g. "একটি ছেলে গ্রামের রাস্তায় হাঁটছিল") and it builds scenes with matched characters, backgrounds, actions and expressions — no AI API, works offline. Also a 🎭 Random Character button.
8. **👄 Live lip-sync** — when a voice clip plays, any character set to the "talk" action opens and closes their mouth with the audio amplitude (WebAudio analyser, no API).

### Extra polish
- Object transform strip now includes motion, keyframes, text styles.
- Duplicate (Ctrl+D), group delete, "N selected" indicator.

---

## 🆕 Character Library (2026-08)

Grow your own character collection — real PNG images that show up in the
editor's character picker and get drawn on the canvas when clicked.

### Two ways to add characters

**1. From the website (cloud library, per account)**
- Open **Assets → Characters → 📚 Character Library → "+ Add PNG"**
- Pick any PNG/JPEG/WEBP — it uploads to your **Firebase Storage**
  (`users/{uid}/characters/library/{id}.png`) and the record is saved in
  **Firestore** (`users/{uid}/characterLibrary/{id}`).
- It appears instantly with a real thumbnail; click it to drop the character
  on the canvas. Hover shows ✕ to remove.
- Needs login. Falls back to Cloudinary `/api/upload` when Firebase Storage
  isn't configured, and to localStorage when Firestore is unavailable.

**2. From the repo (public folder, shown to everyone)**
- Drop PNGs into **`public/characters/`** and list them in
  **`public/characters/manifest.json`**:
  ```json
  [ { "name": "Robot", "file": "robot.png" } ]
  ```
- Push + redeploy — done. No cloud config needed. Two sample characters
  (Robot, Ninja) are included.

### Storage paths & rules (already configured)
- Storage: `users/{uid}/characters/library/{file}.png` — owner read/write, image/*, ≤10 MB
- Firestore: `users/{uid}/characterLibrary/{id}` — owner read/write (rule added to `firestore.rules`)

---

## 🆕 Bug-fix + Premium UI update (2026-08)

### Fixed
1. **Video export produced white/blank short clips** — the export canvas was `display:none` (never rasterized) and frames were advanced with `requestAnimationFrame` (unreliable timing). Now: off-screen-but-rendered canvas, manual `track.requestFrame()` capture, wall-clock `setTimeout` pacing, GIF default on touch devices, and automatic "use GIF" guidance when video fails.
2. **Playback jumped/restarted randomly** — the timeline loop restarted every time the scene changed. Now a single ref-based wall-clock loop runs the whole sequence smoothly without restarting.
3. **Keyframes "didn't work"** — results are now visible while scrubbing (paused), repeated keyframe presses update instead of duplicating, and drag-start snaps to the interpolated position (no jump).
4. **Back button could hang** — it now navigates instantly and saves in the background; autosave can never throw.
5. **Timeline clips** can now be dragged to move and edge-dragged to trim (CapCut-style), with a taller touch-friendly track.

### Upgraded
- Dark premium editor toolbar (gradient buttons, glow), gradient bottom navigation, welcome hint on empty canvas, draft-restore toast.

---

## 🆕 Editor Extension — Master Prompt build (2026-08)

- **Bottom tab bar**: Character · Media · Templates · Image Gen (AI) · Video Gen (AI) · AI Voice · AI Character (AI)
- **Character Library bottom sheet**: search, category chips, 2-col grid with Edit pill + FRONT / 3/4 FRONT / 3/4 BACK pose switcher, 4 placeholder slots (`// TODO: replace with real character assets`)
- **Templates modal**: "Use Templates To Create Project Faster", tabs + search + chips, "+ Blank Scene" default-selected, 3 placeholder templates (`// TODO: replace with real scene thumbnails`), sticky Apply Scene button
- **Timeline upgrade**: scene tabs with kebab menu + add scene + nav arrows, collapsible handle, lock/unlock tracks, clip drag/trim, toolbar (duplicate/cut/keyframe/undo/redo/zoom/fullscreen), playback speed 0.5–2x, time readout
- **Top toolbar**: settings (watermark/timeline toggles), notifications, history, export-image, prominent gradient Download pill, subtext row (v4.0 · build · project-id · ratio)
- **Editor theme** (editor routes only): `#0B0B10` bg, `#16161C` panels, `#5B8DEF` accent, `#8B5CF6` violet, blue→violet gradient on CTAs — via CSS variables in `globals.css` (`.editor-surface`, `.editor-panel`, `.editor-gradient`, `.editor-input`)

---

## 🆕 MASTER PROMPT PART 2 (2026-08)

- **Emoji → lucide icons site-wide** (editor chrome): bottom nav, toolbars, timeline, panels — all controls now use real SVG icons (16–20px, currentColor, strokeWidth 2). Emojis remain only in user-facing text/thumbs.
- **IconButton** component with `default / active / premium (AI·PRO badge) / locked` variants + PillButton.
- **Feature gate + credits** (`useFeatureGate`): Free vs Pro caps (1080p & watermark removal = Pro), AI credits badge near AI tools, graceful no-credit messages.
- **AI Voice (real free TTS)**: browser Web Speech API, Bangla-first, preview + render clip to timeline.
- **Sound library**: 8 procedural SFX/music (WebAudio) with preview + add.
- **Background variants**: day/night/sunset/rain/cloudy tint (renderer + toolbar picker).
- **Flip horizontal** on objects.
- **Global search (Ctrl+K)** across characters/backgrounds/props/templates.
- **Recently used + Favorites** quick panels in Character panel.
- **One-time tutorial overlays** for panels.
- **Bangla/English UI toggle** (settings).
- **Project file export (.animatex) + import**; **aspect presets 16:9 / 9:16 / 1:1** in export.
- **Scene transition picker** (fade/crossfade/slide/zoom) in Scenes panel; **Duplicate Project** button.
- Stubs with clear "Coming soon" state: Text→Image, Text→Video.

---

## 🆕 MASTER PROMPT PART 4 — CRITICAL FIXES (2026-08)

- **Keyframe engine fixed**: playback now starts from the playhead's GLOBAL position (no more jumping to 00:00 / wrong scene), keyframe timestamps land exactly at the playhead, interpolation verified (small→large smooth growth test passes), playhead is a clean pixel-synced red line with a top flag.
- **Action Picker (new)**: bottom sheet with selected-character header + "Selected" badge, "Search Animations", FRONT / 3/4 FRONT / 3/4 BACK tabs, 20 pose tiles each showing a LIVE looping preview of the actual motion (mini-canvas), tap applies to canvas + records a timeline keyframe, current action pre-highlighted. 11 new poses added to the renderer (sit-kneel, namaskar, give, sweep, wash, jog, sit-crossed, sleep-stomach, cook, fly, sleep-back).
- **No emoji in asset panels**: Characters tiles now render real procedural 2D character art on mini canvases; Backgrounds/Props/Expressions/Actions use lucide icons; headers use lucide icons. Zero emoji in Characters/Backgrounds/Props panels.
- **Selection handles**: 2px solid accent border + glow, 12px corner / 9px edge filled handles with white outline, 18px hit tolerance (≈24px touch target), rotation handle circle + connector.
- **Asset expansion**: 31 characters (doctors, farmers, chefs, soldiers, astronauts, kings, princesses, + fox/rabbit/lion/tiger/elephant/horse/sheep/monkey/duck with species features) and 14 themed backgrounds (office, forest, beach, mountain + color/weather variety).
