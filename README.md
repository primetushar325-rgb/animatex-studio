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
