'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';
import {
  saveProjectLocal,
  getProjectLocal,
  getAllProjectsLocal,
  deleteProjectLocal,
  saveDraft,
  getDraft,
} from '@/lib/storage/indexeddb';
import type { Project, CanvasRatio } from '@/types/animation';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
  lastSaved: number | null;

  // Actions
  loadProjects: (userId: string) => Promise<void>;
  createProject: (
    userId: string,
    name: string,
    canvasRatio: CanvasRatio
  ) => Promise<Project>;
  openProject: (projectId: string) => Promise<void>;
  saveProject: (project: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string, newName: string) => Promise<Project>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  closeProject: () => void;
  recoverDraft: (projectId: string) => Promise<void>;
  clearError: () => void;
}

// Debounce helper
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 2000;

function getCanvasDimensions(ratio: CanvasRatio): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  saving: false,
  saveStatus: 'idle',
  error: null,
  lastSaved: null,

  loadProjects: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // First, try to load from IndexedDB for instant display
      const localProjects = await getAllProjectsLocal(userId);
      if (localProjects.length > 0) {
        set({ projects: localProjects });
      }

      // Then sync with Firestore
      try {
        const db = getFirebaseDb();
        const projectsRef = collection(db, 'users', userId, 'projects');
        const q = query(projectsRef, orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);

        const firestoreProjects: Project[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            ownerId: data.ownerId,
            thumbnail: data.thumbnail,
            canvasRatio: data.canvasRatio,
            duration: data.duration,
            sceneCount: data.sceneCount,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt,
            status: data.status,
            fps: data.fps,
            width: data.width,
            height: data.height,
          } as Project;
        });

        // Update local cache
        for (const project of firestoreProjects) {
          await saveProjectLocal(project);
        }

        set({ projects: firestoreProjects, loading: false });
      } catch {
        // If Firestore fails, we still have local data
        set({ loading: false });
      }
    } catch (err) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to load projects', loading: false });
    }
  },

  createProject: async (userId: string, name: string, canvasRatio: CanvasRatio) => {
    set({ loading: true, error: null });
    try {
      const { width, height } = getCanvasDimensions(canvasRatio);
      const projectId = uuidv4();
      const now = Date.now();

      const project: Project = {
        id: projectId,
        name,
        ownerId: userId,
        canvasRatio,
        duration: 0,
        sceneCount: 1,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        fps: 30,
        width,
        height,
      };

      // Save to IndexedDB first for immediate feedback
      await saveProjectLocal(project);

      // Save to Firestore
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'users', userId, 'projects', projectId), {
          ...project,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Mark as pending sync if Firestore fails
      }

      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        loading: false,
      }));

      return project;
    } catch (err) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to create project', loading: false });
      throw err;
    }
  },

  openProject: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      // Try local first
      let project = await getProjectLocal(projectId);

      if (!project) {
        // Fetch from Firestore
        const { projects } = get();
        const localProject = projects.find((p) => p.id === projectId);
        if (localProject) {
          project = localProject;
        }
      }

      if (!project) {
        throw new Error('Project not found');
      }

      // Check for draft recovery
      const draft = await getDraft(projectId);
      if (draft) {
        // We have a draft to potentially recover
        console.log('Draft available for recovery');
      }

      set({ currentProject: project, loading: false });
    } catch (err) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to open project', loading: false });
      throw err;
    }
  },

  saveProject: async (updates: Partial<Project>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // Update local state immediately
    const updatedProject = {
      ...currentProject,
      ...updates,
      updatedAt: Date.now(),
    };
    set({ currentProject: updatedProject, saveStatus: 'saving' });

    // Save to IndexedDB immediately
    await saveProjectLocal(updatedProject);

    // Save draft for recovery
    await saveDraft(currentProject.id, updatedProject);

    // Debounce Firestore writes
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        const db = getFirebaseDb();
        await setDoc(
          doc(db, 'users', currentProject.ownerId, 'projects', currentProject.id),
          {
            ...updatedProject,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        set({ saveStatus: 'saved', lastSaved: Date.now() });

        // Reset status after delay
        setTimeout(() => set({ saveStatus: 'idle' }), 2000);
      } catch {
        set({ saveStatus: 'error' });
      }
    }, SAVE_DEBOUNCE_MS);
  },

  deleteProject: async (projectId: string) => {
    const { projects, currentProject } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    set({ loading: true, error: null });
    try {
      // Delete from IndexedDB
      await deleteProjectLocal(projectId);

      // Delete from Firestore
      try {
        const db = getFirebaseDb();
        await deleteDoc(doc(db, 'users', project.ownerId, 'projects', projectId));
      } catch {
        // Continue even if Firestore fails
      }

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: currentProject?.id === projectId ? null : currentProject,
        loading: false,
      }));
    } catch (err) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to delete project', loading: false });
      throw err;
    }
  },

  duplicateProject: async (projectId: string, newName: string) => {
    const { projects } = get();
    const original = projects.find((p) => p.id === projectId);
    if (!original) throw new Error('Project not found');

    const newId = uuidv4();
    const now = Date.now();

    const newProject: Project = {
      ...original,
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };

    await saveProjectLocal(newProject);

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', original.ownerId, 'projects', newId), {
        ...newProject,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Continue with local only
    }

    set((state) => ({
      projects: [newProject, ...state.projects],
    }));

    return newProject;
  },

  renameProject: async (projectId: string, newName: string) => {
    const { projects, currentProject } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject = { ...project, name: newName, updatedAt: Date.now() };
    await saveProjectLocal(updatedProject);

    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'users', project.ownerId, 'projects', projectId),
        { name: newName, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      // Continue with local only
    }

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? updatedProject : p
      ),
      currentProject:
        currentProject?.id === projectId ? updatedProject : currentProject,
    }));
  },

  closeProject: () => {
    set({ currentProject: null });
  },

  recoverDraft: async (projectId: string) => {
    const draft = await getDraft(projectId);
    if (draft) {
      set({ currentProject: draft as Project });
    }
  },

  clearError: () => set({ error: null }),
}));
