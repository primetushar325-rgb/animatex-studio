// ============================================================================
// Character Library
// ----------------------------------------------------------------------------
// Two ways to grow your character collection:
//
// 1) Cloud library (per-user):
//    - PNG uploaded to Firebase Storage: users/{uid}/characters/library/{id}.png
//      (Storage rules already allow owner read/write, image/*, <=10MB)
//    - Metadata (name + imageUrl) saved in Firestore:
//      users/{uid}/characterLibrary/{id}
//    - Falls back to Cloudinary /api/upload when Firebase Storage is not
//      configured, and to localStorage when Firestore is unavailable.
//
// 2) Public folder (repo): drop PNGs into /public/characters/ and list them
//    in /public/characters/manifest.json — they show up for every visitor with
//    zero cloud configuration.
// ============================================================================

import type { Character } from '@/types/animation';
import { getFirebaseDb, getFirebaseStorage } from '@/lib/firebase/client';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface LibraryCharacter {
  id: string;
  name: string;
  imageUrl: string;
  source: 'cloud' | 'public' | 'local';
}

const LOCAL_CACHE_KEY = 'animatex-character-library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lib-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function loadLocalCache(): Record<string, LibraryCharacter> {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LibraryCharacter>) : {};
  } catch {
    return {};
  }
}

function saveLocalCache(cache: Record<string, LibraryCharacter>) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Public folder characters (static, always available)
// ---------------------------------------------------------------------------

let publicManifest: LibraryCharacter[] | null = null;

export async function getPublicCharacters(): Promise<LibraryCharacter[]> {
  if (publicManifest) return publicManifest;
  try {
    const res = await fetch('/characters/manifest.json', { cache: 'no-store' });
    if (!res.ok) {
      publicManifest = [];
      return publicManifest;
    }
    const list = (await res.json()) as { name: string; file: string }[];
    publicManifest = list.map((item, i) => ({
      id: `public-${i}-${item.file}`,
      name: item.name || item.file.replace(/\.[^.]+$/, ''),
      imageUrl: `/characters/${item.file}`,
      source: 'public',
    }));
    return publicManifest;
  } catch {
    publicManifest = [];
    return publicManifest;
  }
}

export function invalidatePublicManifest() {
  publicManifest = null;
}

// ---------------------------------------------------------------------------
// Cloud library (Firestore-backed, user-scoped)
// ---------------------------------------------------------------------------

function firestoreAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  } catch {
    return false;
  }
}

function storageAvailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
  } catch {
    return false;
  }
}

/**
 * Add a character PNG to the user's cloud library.
 * Returns the created library character (also cached locally).
 */
export async function addToLibrary(userId: string, file: File, name: string): Promise<LibraryCharacter> {
  const item: LibraryCharacter = {
    id: uid(),
    name: name || file.name.replace(/\.[^.]+$/, ''),
    imageUrl: '',
    source: 'cloud',
  };

  // upload (Firebase Storage with the real uid, or Cloudinary)
  try {
    if (storageAvailable()) {
      const storage = getFirebaseStorage();
      const storageRef = ref(storage, `users/${userId}/characters/library/${item.id}.png`);
      await uploadBytes(storageRef, file);
      item.imageUrl = await getDownloadURL(storageRef);
    } else {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      item.imageUrl = data.url;
    }
  } catch (err) {
    console.error('Upload failed:', err);
    throw new Error('Upload failed — check that Firebase Storage or Cloudinary is configured.');
  }

  // persist record (Firestore → localStorage fallback)
  try {
    if (firestoreAvailable() && userId) {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', userId, 'characterLibrary', item.id), {
        name: item.name,
        imageUrl: item.imageUrl,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('Firestore save failed, keeping local only', err);
  }

  const cache = loadLocalCache();
  cache[item.id] = item;
  saveLocalCache(cache);
  return item;
}

/** List all cloud library characters for a user (Firestore + localStorage cache). */
export async function getCloudLibrary(userId: string): Promise<LibraryCharacter[]> {
  const cache = loadLocalCache();
  const items: LibraryCharacter[] = [];

  if (firestoreAvailable() && userId) {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'users', userId, 'characterLibrary'));
      const docs = snap.docs.map((d) => {
        const data = d.data() as { name?: string; imageUrl?: string };
        return {
          id: d.id,
          name: data.name || 'Character',
          imageUrl: data.imageUrl || '',
          source: 'cloud' as const,
        };
      });
      items.push(...docs.filter((d) => !!d.imageUrl));
    } catch (err) {
      console.warn('Firestore read failed, using local cache', err);
    }
  }

  // merge local-only items that aren't in Firestore yet
  for (const item of Object.values(cache)) {
    if (item.source === 'cloud' && !items.some((i) => i.id === item.id)) {
      items.push(item);
    }
  }

  return items;
}

/** Remove a character from the user's cloud library. */
export async function removeFromLibrary(userId: string, item: LibraryCharacter): Promise<void> {
  if (item.source !== 'cloud') return;

  // remove from Firestore
  try {
    if (firestoreAvailable() && userId) {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'users', userId, 'characterLibrary', item.id));
    }
  } catch {
    // ignore
  }

  // remove local cache
  const cache = loadLocalCache();
  delete cache[item.id];
  saveLocalCache(cache);
}

/** Convert a library item into a Canvas-ready Character asset. */
export function libraryItemToCharacter(item: LibraryCharacter, projectId: string): Character {
  return {
    id: item.id,
    projectId,
    name: item.name,
    type: 'custom',
    imageUrl: item.imageUrl,
    isCustom: true,
    defaultExpression: 'neutral',
    defaultAction: 'idle',
  };
}
