'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project, Scene, TimelineTrack, TimelineClip, Character, Background, Prop, AudioClip, TextElement } from '@/types/animation';

interface AnimationStudioDB extends DBSchema {
  projects: {
    key: string;
    value: Project & { localOnly?: boolean; pendingSync?: boolean };
    indexes: { 'by-owner': string; 'by-updated': number };
  };
  scenes: {
    key: string;
    value: Scene & { pendingSync?: boolean };
    indexes: { 'by-project': string };
  };
  tracks: {
    key: string;
    value: TimelineTrack & { pendingSync?: boolean };
    indexes: { 'by-scene': string };
  };
  clips: {
    key: string;
    value: TimelineClip & { pendingSync?: boolean };
    indexes: { 'by-track': string; 'by-scene': string };
  };
  characters: {
    key: string;
    value: Character & { pendingSync?: boolean };
    indexes: { 'by-project': string };
  };
  backgrounds: {
    key: string;
    value: Background & { pendingSync?: boolean };
    indexes: { 'by-project': string };
  };
  props: {
    key: string;
    value: Prop & { pendingSync?: boolean };
    indexes: { 'by-project': string };
  };
  audioClips: {
    key: string;
    value: AudioClip & { pendingSync?: boolean };
    indexes: { 'by-project': string };
  };
  textElements: {
    key: string;
    value: TextElement & { pendingSync?: boolean };
    indexes: { 'by-scene': string };
  };
  assets: {
    key: string;
    value: { id: string; type: string; blob: Blob; pendingUpload?: boolean };
  };
  drafts: {
    key: string;
    value: { projectId: string; timestamp: number; state: string };
    indexes: { 'by-project': string };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'animation-studio';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AnimationStudioDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AnimationStudioDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AnimationStudioDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-owner', 'ownerId');
        projectStore.createIndex('by-updated', 'updatedAt');
      }

      // Scenes store
      if (!db.objectStoreNames.contains('scenes')) {
        const sceneStore = db.createObjectStore('scenes', { keyPath: 'id' });
        sceneStore.createIndex('by-project', 'projectId');
      }

      // Tracks store
      if (!db.objectStoreNames.contains('tracks')) {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
        trackStore.createIndex('by-scene', 'sceneId');
      }

      // Clips store
      if (!db.objectStoreNames.contains('clips')) {
        const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
        clipStore.createIndex('by-track', 'trackId');
        clipStore.createIndex('by-scene', 'sceneId');
      }

      // Characters store
      if (!db.objectStoreNames.contains('characters')) {
        const charStore = db.createObjectStore('characters', { keyPath: 'id' });
        charStore.createIndex('by-project', 'projectId');
      }

      // Backgrounds store
      if (!db.objectStoreNames.contains('backgrounds')) {
        const bgStore = db.createObjectStore('backgrounds', { keyPath: 'id' });
        bgStore.createIndex('by-project', 'projectId');
      }

      // Props store
      if (!db.objectStoreNames.contains('props')) {
        const propStore = db.createObjectStore('props', { keyPath: 'id' });
        propStore.createIndex('by-project', 'projectId');
      }

      // Audio clips store
      if (!db.objectStoreNames.contains('audioClips')) {
        const audioStore = db.createObjectStore('audioClips', { keyPath: 'id' });
        audioStore.createIndex('by-project', 'projectId');
      }

      // Text elements store
      if (!db.objectStoreNames.contains('textElements')) {
        const textStore = db.createObjectStore('textElements', { keyPath: 'id' });
        textStore.createIndex('by-scene', 'sceneId');
      }

      // Assets store (for blob storage)
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }

      // Drafts store
      if (!db.objectStoreNames.contains('drafts')) {
        const draftStore = db.createObjectStore('drafts', { keyPath: 'projectId' });
        draftStore.createIndex('by-project', 'projectId');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });

  return dbInstance;
}

// Project operations
export async function saveProjectLocal(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', { ...project, pendingSync: true });
}

export async function getProjectLocal(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function getAllProjectsLocal(ownerId: string): Promise<Project[]> {
  const db = await getDB();
  return db.getAllFromIndex('projects', 'by-owner', ownerId);
}

export async function deleteProjectLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
  
  // Also delete related data
  const scenes = await db.getAllFromIndex('scenes', 'by-project', id);
  for (const scene of scenes) {
    await db.delete('scenes', scene.id);
  }
}

// Scene operations
export async function saveSceneLocal(scene: Scene): Promise<void> {
  const db = await getDB();
  await db.put('scenes', { ...scene, pendingSync: true });
}

export async function getScenesLocal(projectId: string): Promise<Scene[]> {
  const db = await getDB();
  return db.getAllFromIndex('scenes', 'by-project', projectId);
}

// Track operations
export async function saveTrackLocal(track: TimelineTrack): Promise<void> {
  const db = await getDB();
  await db.put('tracks', { ...track, pendingSync: true });
}

export async function getTracksLocal(sceneId: string): Promise<TimelineTrack[]> {
  const db = await getDB();
  return db.getAllFromIndex('tracks', 'by-scene', sceneId);
}

// Clip operations
export async function saveClipLocal(clip: TimelineClip): Promise<void> {
  const db = await getDB();
  await db.put('clips', { ...clip, pendingSync: true });
}

export async function getClipsLocal(sceneId: string): Promise<TimelineClip[]> {
  const db = await getDB();
  return db.getAllFromIndex('clips', 'by-scene', sceneId);
}

// Character operations
export async function saveCharacterLocal(character: Character): Promise<void> {
  const db = await getDB();
  await db.put('characters', { ...character, pendingSync: true });
}

export async function getCharactersLocal(projectId: string): Promise<Character[]> {
  const db = await getDB();
  return db.getAllFromIndex('characters', 'by-project', projectId);
}

// Background operations
export async function saveBackgroundLocal(background: Background): Promise<void> {
  const db = await getDB();
  await db.put('backgrounds', { ...background, pendingSync: true });
}

export async function getBackgroundsLocal(projectId: string): Promise<Background[]> {
  const db = await getDB();
  return db.getAllFromIndex('backgrounds', 'by-project', projectId);
}

// Props operations
export async function savePropLocal(prop: Prop): Promise<void> {
  const db = await getDB();
  await db.put('props', { ...prop, pendingSync: true });
}

export async function getPropsLocal(projectId: string): Promise<Prop[]> {
  const db = await getDB();
  return db.getAllFromIndex('props', 'by-project', projectId);
}

// Audio operations
export async function saveAudioClipLocal(audioClip: AudioClip): Promise<void> {
  const db = await getDB();
  await db.put('audioClips', { ...audioClip, pendingSync: true });
}

export async function getAudioClipsLocal(projectId: string): Promise<AudioClip[]> {
  const db = await getDB();
  return db.getAllFromIndex('audioClips', 'by-project', projectId);
}

// Asset blob storage
export async function saveAssetBlob(id: string, type: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('assets', { id, type, blob, pendingUpload: true });
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const asset = await db.get('assets', id);
  return asset?.blob;
}

// Draft operations for recovery
export async function saveDraft(projectId: string, state: unknown): Promise<void> {
  const db = await getDB();
  await db.put('drafts', {
    projectId,
    timestamp: Date.now(),
    state: JSON.stringify(state),
  });
}

export async function getDraft(projectId: string): Promise<unknown | null> {
  const db = await getDB();
  const draft = await db.get('drafts', projectId);
  if (draft) {
    return JSON.parse(draft.state);
  }
  return null;
}

export async function deleteDraft(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete('drafts', projectId);
}

// Settings
export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('settings', key) as Promise<T | undefined>;
}

// Get pending sync items
export async function getPendingSyncProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAll('projects');
  return all.filter(p => p.pendingSync);
}

export async function markProjectSynced(id: string): Promise<void> {
  const db = await getDB();
  const project = await db.get('projects', id);
  if (project) {
    project.pendingSync = false;
    await db.put('projects', project);
  }
}

// Clear all local data
export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  await db.clear('projects');
  await db.clear('scenes');
  await db.clear('tracks');
  await db.clear('clips');
  await db.clear('characters');
  await db.clear('backgrounds');
  await db.clear('props');
  await db.clear('audioClips');
  await db.clear('textElements');
  await db.clear('assets');
  await db.clear('drafts');
}

// Get storage usage estimate
export async function getStorageUsage(): Promise<{ usage: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}
