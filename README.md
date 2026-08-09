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
