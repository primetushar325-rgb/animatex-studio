'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Scene,
  TimelineTrack,
  TimelineClip,
  Keyframe,
  Character,
  Background,
  Prop,
  TextElement,
  AudioClip,
  CharacterExpression,
  CharacterAction,
  KeyframeProperties,
  CanvasObject,
} from '@/types/animation';

export type EditorTool = 'select' | 'move' | 'scale' | 'rotate' | 'text' | 'draw';

interface HistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

interface EditorSnapshot {
  scenes: Scene[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  canvasObjects: CanvasObject[];
  selectedObjectId: string | null;
  currentSceneId: string | null;
}

interface EditorState {
  // Scenes
  scenes: Scene[];
  currentSceneId: string | null;
  
  // Timeline
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
  
  // Canvas
  canvasObjects: CanvasObject[];
  selectedObjectId: string | null;
  /** Multi-selection (includes the primary selectedObjectId when set) */
  selectedObjectIds: string[];
  /** Transient live lip-sync level 0..1 during playback (not persisted) */
  lipSyncLevel: number;
  activeTool: EditorTool;
  
  // Assets
  characters: Character[];
  backgrounds: Background[];
  props: Prop[];
  audioClips: AudioClip[];
  textElements: TextElement[];
  
  // History
  history: HistoryState;
  
  // UI State
  showTimeline: boolean;
  showAssetPanel: boolean;
  activePanel: 'characters' | 'backgrounds' | 'props' | 'audio' | 'text' | 'script' | null;

  // Watermark
  watermarkEnabled: boolean;
  watermarkText: string;

  // Actions - Scenes
  addScene: (name?: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  setCurrentScene: (sceneId: string) => void;
  updateScene: (sceneId: string, patch: Partial<Scene>) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  
  // Actions - Timeline
  setCurrentTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setZoom: (zoom: number) => void;
  setPlaybackRate: (rate: number) => void;
  /** Timeline engine extras */
  fps: number;
  setFps: (fps: number) => void;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  setLoopRegion: (start: number | null, end: number | null) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  autoKeyframe: boolean;
  setAutoKeyframe: (v: boolean) => void;
  markers: { id: string; time: number; label: string }[];
  addMarker: (time: number, label?: string) => void;
  deleteMarker: (id: string) => void;
  renameMarker: (id: string, label: string) => void;
  moveKeyframe: (clipId: string, keyframeId: string, newTime: number) => void;
  setKeyframeEasing: (clipId: string, keyframeId: string, easing: Keyframe['easing']) => void;
  
  // Actions - Tracks
  addTrack: (type: TimelineTrack['type'], name: string) => void;
  deleteTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  
  // Actions - Clips
  addClip: (trackId: string, assetId: string, startTime: number, duration: number) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  trimClip: (clipId: string, newStart: number, newDuration: number) => void;
  setClipDuration: (clipId: string, newDuration: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  
  // Actions - Keyframes
  addKeyframe: (clipId: string, time: number, properties: KeyframeProperties) => void;
  deleteKeyframe: (clipId: string, keyframeId: string) => void;
  updateKeyframe: (clipId: string, keyframeId: string, properties: KeyframeProperties) => void;
  
  // Actions - Canvas
  addCanvasObject: (obj: Omit<CanvasObject, 'id'>) => void;
  updateCanvasObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteCanvasObject: (id: string) => void;
  deleteCanvasObjects: (ids: string[]) => void;
  duplicateCanvasObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  setLipSyncLevel: (level: number) => void;
  setTool: (tool: EditorTool) => void;
  moveObject: (id: string, x: number, y: number) => void;
  scaleObject: (id: string, scaleX: number, scaleY: number) => void;
  rotateObject: (id: string, rotation: number) => void;
  reorderObjects: (id: string, newZIndex: number) => void;
  setObjectExpression: (id: string, expression: CharacterExpression) => void;
  setObjectAction: (id: string, action: CharacterAction) => void;
  /** Called once at the end of a drag/transform so undo can restore it. */
  commitTransform: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Actions - Watermark
  setWatermark: (enabled: boolean, text: string) => void;
  
  // Actions - Assets
  addCharacter: (character: Character) => void;
  addBackground: (background: Background) => void;
  addProp: (prop: Prop) => void;
  addAudioClip: (audioClip: AudioClip) => void;
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void;
  addTextElement: (text: TextElement) => void;
  deleteAsset: (type: 'character' | 'background' | 'prop' | 'audio', id: string) => void;
  
  // Actions - History
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;
  
  // Actions - UI
  toggleTimeline: () => void;
  toggleAssetPanel: () => void;
  setActivePanel: (panel: EditorState['activePanel']) => void;
  
  // Actions - Initialize
  initializeEditor: (projectId: string) => void;
  resetEditor: () => void;
  
  // Actions - State
  loadEditorState: (state: Partial<EditorState>) => void;
  getEditorState: () => Partial<EditorState>;
}

const MAX_HISTORY_SIZE = 50;

const createDefaultScene = (order: number = 0): Scene => ({
  id: uuidv4(),
  projectId: '',
  name: `Scene ${order + 1}`,
  order,
  duration: 5000,
  backgroundColor: '#FFFFFF',
  cameraSettings: {
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    keyframes: [],
  },
  transition: {
    type: 'none',
    duration: 500,
  },
});

const createDefaultTracks = (sceneId: string): TimelineTrack[] => [
  { id: uuidv4(), sceneId, type: 'background', name: 'Background', order: 0, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'character', name: 'Characters', order: 1, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'prop', name: 'Props', order: 2, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'text', name: 'Text', order: 3, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'voice', name: 'Voice', order: 4, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'music', name: 'Music', order: 5, muted: false, locked: false, visible: true },
  { id: uuidv4(), sceneId, type: 'sfx', name: 'Sound Effects', order: 6, muted: false, locked: false, visible: true },
];

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial State
  scenes: [],
  currentSceneId: null,
  tracks: [],
  clips: [],
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  zoom: 1,
  fps: 30,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,
  snapEnabled: true,
  autoKeyframe: false,
  markers: [],
  canvasObjects: [],
  selectedObjectId: null,
  selectedObjectIds: [],
  lipSyncLevel: 0,
  activeTool: 'select',
  characters: [],
  backgrounds: [],
  props: [],
  audioClips: [],
  textElements: [],
  history: { past: [], future: [] },
  showTimeline: true,
  showAssetPanel: false,
  activePanel: null,
  watermarkEnabled: true,
  watermarkText: 'AnimateX Studio',

  // Scene Actions
  addScene: (name?: string) => {
    const { scenes, currentSceneId } = get();
    const newScene = createDefaultScene(scenes.length);
    if (name) newScene.name = name;
    
    const newTracks = createDefaultTracks(newScene.id);
    
    set((state) => ({
      scenes: [...state.scenes, newScene],
      tracks: [...state.tracks, ...newTracks],
      currentSceneId: newScene.id,
    }));
    
    get().saveSnapshot();
  },

  deleteScene: (sceneId: string) => {
    const { scenes, currentSceneId, tracks, clips, canvasObjects } = get();
    if (scenes.length <= 1) return; // Don't delete last scene

    const newScenes = scenes.filter((s) => s.id !== sceneId);
    const newTracks = tracks.filter((t) => t.sceneId !== sceneId);
    const trackIds = tracks.filter((t) => t.sceneId === sceneId).map((t) => t.id);
    const newClips = clips.filter((c) => !trackIds.includes(c.trackId));
    const newObjects = canvasObjects.filter((o) => o.sceneId !== sceneId);

    set({
      scenes: newScenes.map((s, i) => ({ ...s, order: i })),
      tracks: newTracks,
      clips: newClips,
      canvasObjects: newObjects,
      selectedObjectId: get().selectedObjectId,
      currentSceneId: currentSceneId === sceneId ? newScenes[0]?.id || null : currentSceneId,
    });

    get().saveSnapshot();
  },

  duplicateScene: (sceneId: string) => {
    const { scenes, tracks, clips } = get();
    const original = scenes.find((s) => s.id === sceneId);
    if (!original) return;
    
    const newScene: Scene = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      order: scenes.length,
    };
    
    const originalTracks = tracks.filter((t) => t.sceneId === sceneId);
    const trackIdMap: Record<string, string> = {};
    
    const newTracks = originalTracks.map((t) => {
      const newId = uuidv4();
      trackIdMap[t.id] = newId;
      return { ...t, id: newId, sceneId: newScene.id };
    });
    
    const originalClips = clips.filter((c) => trackIdMap[c.trackId] !== undefined || originalTracks.some(t => t.id === c.trackId));
    const newClips = originalClips.map((c) => ({
      ...c,
      id: uuidv4(),
      trackId: trackIdMap[c.trackId] || c.trackId,
      sceneId: newScene.id,
    }));
    
    set((state) => ({
      scenes: [...state.scenes, newScene],
      tracks: [...state.tracks, ...newTracks],
      clips: [...state.clips, ...newClips],
      currentSceneId: newScene.id,
    }));
    
    get().saveSnapshot();
  },

  renameScene: (sceneId: string, name: string) => {
    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === sceneId ? { ...s, name } : s
      ),
    }));
  },

  setCurrentScene: (sceneId: string) => {
    set({ currentSceneId: sceneId, currentTime: 0 });
  },

  updateScene: (sceneId: string, patch: Partial<Scene>) => {
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    }));
  },

  reorderScenes: (fromIndex: number, toIndex: number) => {
    const { scenes } = get();
    const newScenes = [...scenes];
    const [removed] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, removed);
    set({ scenes: newScenes.map((s, i) => ({ ...s, order: i })) });
  },

  // Timeline Actions
  setCurrentTime: (time: number) => set({ currentTime: time }),
  
  play: () => set({ isPlaying: true }),
  
  pause: () => set({ isPlaying: false }),
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  seek: (time: number) => {
    const { duration } = get();
    set({ currentTime: Math.max(0, Math.min(time, duration)), isPlaying: false });
  },
  
  setZoom: (zoom: number) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

  setPlaybackRate: (rate: number) =>
    set({ playbackRate: Math.max(0.25, Math.min(4, rate)) }),

  setFps: (fps: number) => set({ fps: Math.max(1, Math.min(120, Math.round(fps))) }),

  setLoopRegion: (start: number | null, end: number | null) => {
    const cur = get();
    const loopStart = start ?? cur.loopStart;
    const loopEnd = end ?? cur.loopEnd;
    set({ loopStart, loopEnd, loopEnabled: start !== null || end !== null });
  },

  setSnapEnabled: (v: boolean) => set({ snapEnabled: v }),
  setAutoKeyframe: (v: boolean) => set({ autoKeyframe: v }),

  addMarker: (time: number, label = 'Marker') => {
    const m = { id: uuidv4(), time, label };
    set((st) => ({ markers: [...st.markers, m].sort((a, b) => a.time - b.time) }));
  },
  deleteMarker: (id: string) => {
    set((st) => ({ markers: st.markers.filter((m) => m.id !== id) }));
  },
  renameMarker: (id: string, label: string) => {
    set((st) => ({ markers: st.markers.map((m) => (m.id === id ? { ...m, label } : m)) }));
  },

  moveKeyframe: (clipId: string, keyframeId: string, newTime: number) => {
    set((st) => ({
      clips: st.clips.map((c) =>
        c.id !== clipId
          ? c
          : {
              ...c,
              keyframes: c.keyframes
                .map((k) => (k.id === keyframeId ? { ...k, time: Math.max(0, newTime) } : k))
                .sort((a, b) => a.time - b.time),
            }
      ),
    }));
  },

  setKeyframeEasing: (clipId: string, keyframeId: string, easing: Keyframe['easing']) => {
    set((st) => ({
      clips: st.clips.map((c) =>
        c.id !== clipId
          ? c
          : {
              ...c,
              keyframes: c.keyframes.map((k) => (k.id === keyframeId ? { ...k, easing } : k)),
            }
      ),
    }));
  },

  setClipDuration: (clipId: string, newDuration: number) => {
    const safe = Math.max(200, newDuration);
    set((st) => ({
      clips: st.clips.map((c) =>
        c.id === clipId ? { ...c, duration: safe, endTime: c.startTime + safe } : c
      ),
    }));
  },

  // Track Actions
  addTrack: (type: TimelineTrack['type'], name: string) => {
    const { currentSceneId, tracks } = get();
    if (!currentSceneId) return;
    
    const sceneTracks = tracks.filter((t) => t.sceneId === currentSceneId);
    const newTrack: TimelineTrack = {
      id: uuidv4(),
      sceneId: currentSceneId,
      type,
      name,
      order: sceneTracks.length,
      muted: false,
      locked: false,
      visible: true,
    };
    
    set((state) => ({ tracks: [...state.tracks, newTrack] }));
    get().saveSnapshot();
  },

  deleteTrack: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      clips: state.clips.filter((c) => c.trackId !== trackId),
    }));
    get().saveSnapshot();
  },

  toggleTrackMute: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }));
  },

  toggleTrackVisibility: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, visible: !t.visible } : t
      ),
    }));
  },

  toggleTrackLock: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    }));
  },

  reorderTracks: (fromIndex: number, toIndex: number) => {
    const { tracks, currentSceneId } = get();
    const sceneTracks = tracks.filter((t) => t.sceneId === currentSceneId);
    const otherTracks = tracks.filter((t) => t.sceneId !== currentSceneId);
    
    const newSceneTracks = [...sceneTracks];
    const [removed] = newSceneTracks.splice(fromIndex, 1);
    newSceneTracks.splice(toIndex, 0, removed);
    
    set({
      tracks: [...otherTracks, ...newSceneTracks.map((t, i) => ({ ...t, order: i }))],
    });
  },

  // Clip Actions
  addClip: (trackId: string, assetId: string, startTime: number, duration: number) => {
    const { currentSceneId } = get();
    if (!currentSceneId) return;
    
    const newClip: TimelineClip = {
      id: uuidv4(),
      trackId,
      sceneId: currentSceneId,
      assetId,
      startTime,
      endTime: startTime + duration,
      duration,
      trimStart: 0,
      trimEnd: 0,
      keyframes: [],
    };
    
    set((state) => ({ clips: [...state.clips, newClip] }));
    get().saveSnapshot();
  },

  deleteClip: (clipId: string) => {
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== clipId),
    }));
    get().saveSnapshot();
  },

  moveClip: (clipId: string, newStartTime: number) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, startTime: newStartTime, endTime: newStartTime + c.duration }
          : c
      ),
    }));
  },

  trimClip: (clipId: string, newStart: number, newDuration: number) => {
    const safeDur = Math.max(200, newDuration);
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              startTime: newStart,
              duration: safeDur,
              endTime: newStart + safeDur,
            }
          : c
      ),
    }));
  },

  splitClip: (clipId: string, splitTime: number) => {
    const { clips } = get();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || splitTime <= clip.startTime || splitTime >= clip.endTime) return;

    const firstDuration = splitTime - clip.startTime;
    const secondDuration = clip.endTime - splitTime;

    // Keyframes stay logically correct: clip A keeps keyframes <= split,
    // clip B keeps the rest with local times shifted by firstDuration.
    const aKfs = clip.keyframes.filter((k) => k.time <= firstDuration);
    const bKfs = clip.keyframes
      .filter((k) => k.time > firstDuration)
      .map((k) => ({ ...k, time: k.time - firstDuration }));

    const firstClip: TimelineClip = {
      ...clip,
      endTime: splitTime,
      duration: firstDuration,
      keyframes: aKfs,
    };

    const secondClip: TimelineClip = {
      ...clip,
      id: uuidv4(),
      startTime: splitTime,
      duration: secondDuration,
      keyframes: bKfs,
    };

    set((state) => ({
      clips: [
        ...state.clips.filter((c) => c.id !== clipId),
        firstClip,
        secondClip,
      ],
    }));
    get().saveSnapshot();
  },

  duplicateClip: (clipId: string) => {
    const { clips } = get();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    
    const newClip: TimelineClip = {
      ...clip,
      id: uuidv4(),
      startTime: clip.endTime,
      endTime: clip.endTime + clip.duration,
      keyframes: clip.keyframes.map((k) => ({ ...k, id: uuidv4() })),
    };
    
    set((state) => ({ clips: [...state.clips, newClip] }));
    get().saveSnapshot();
  },

  // Keyframe Actions
  addKeyframe: (clipId: string, time: number, properties: KeyframeProperties) => {
    // upsert: replace an existing keyframe at (nearly) the same time
    set((state) => ({
      clips: state.clips.map((c) => {
        if (c.id !== clipId) return c;
        const existing = c.keyframes.find((k) => Math.abs(k.time - time) < 16);
        if (existing) {
          return {
            ...c,
            keyframes: c.keyframes.map((k) =>
              k.id === existing.id
                ? { ...k, time, properties, easing: 'ease-in-out' }
                : k
            ),
          };
        }
        const newKeyframe: Keyframe = {
          id: uuidv4(),
          clipId,
          time,
          properties,
          easing: 'ease-in-out',
        };
        return {
          ...c,
          keyframes: [...c.keyframes, newKeyframe].sort((a, b) => a.time - b.time),
        };
      }),
    }));
    get().saveSnapshot();
  },

  deleteKeyframe: (clipId: string, keyframeId: string) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, keyframes: c.keyframes.filter((k) => k.id !== keyframeId) }
          : c
      ),
    }));
    get().saveSnapshot();
  },

  updateKeyframe: (clipId: string, keyframeId: string, properties: KeyframeProperties) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              keyframes: c.keyframes.map((k) =>
                k.id === keyframeId ? { ...k, properties: { ...k.properties, ...properties } } : k
              ),
            }
          : c
      ),
    }));
  },

  // Canvas Actions
  addCanvasObject: (obj: Omit<CanvasObject, 'id'>) => {
    const { currentSceneId } = get();
    const newObj: CanvasObject = {
      ...obj,
      id: uuidv4(),
      sceneId: currentSceneId ?? undefined,
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
    };
    set((state) => ({
      canvasObjects: [...state.canvasObjects, newObj],
      selectedObjectId: newObj.id,
    }));
    get().saveSnapshot();
  },

  updateCanvasObject: (id: string, updates: Partial<CanvasObject>) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
  },

  deleteCanvasObject: (id: string) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      selectedObjectIds: state.selectedObjectIds.filter((oid) => oid !== id),
    }));
    get().saveSnapshot();
  },

  deleteCanvasObjects: (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    set((state) => ({
      canvasObjects: state.canvasObjects.filter((obj) => !idSet.has(obj.id)),
      selectedObjectId: state.selectedObjectId && idSet.has(state.selectedObjectId) ? null : state.selectedObjectId,
      selectedObjectIds: state.selectedObjectIds.filter((oid) => !idSet.has(oid)),
    }));
    get().saveSnapshot();
  },

  duplicateCanvasObject: (id: string) => {
    const { canvasObjects } = get();
    const original = canvasObjects.find((o) => o.id === id);
    if (!original) return;

    const copy: CanvasObject = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      x: original.x + 24,
      y: original.y + 24,
      motion: 'none',
    };

    set((state) => ({
      canvasObjects: [...state.canvasObjects, copy],
      selectedObjectId: copy.id,
    }));
    get().saveSnapshot();
  },

  selectObject: (id: string | null) =>
    set({ selectedObjectId: id, selectedObjectIds: id ? [id] : [] }),

  toggleMultiSelect: (id: string) => {
    set((state) => {
      const has = state.selectedObjectIds.includes(id);
      const next = has
        ? state.selectedObjectIds.filter((oid) => oid !== id)
        : [...state.selectedObjectIds, id];
      return {
        selectedObjectIds: next,
        // last clicked becomes the primary object
        selectedObjectId: id,
      };
    });
  },

  clearMultiSelect: () => set({ selectedObjectIds: [] }),

  setLipSyncLevel: (level: number) => {
    // tiny float changes are ignored to avoid needless re-renders
    if (Math.abs(get().lipSyncLevel - level) > 0.01) {
      set({ lipSyncLevel: level });
    }
  },

  setTool: (tool: EditorTool) => set({ activeTool: tool }),

  moveObject: (id: string, x: number, y: number) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, x, y } : obj
      ),
    }));
  },

  scaleObject: (id: string, scaleX: number, scaleY: number) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, scaleX, scaleY } : obj
      ),
    }));
  },

  rotateObject: (id: string, rotation: number) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, rotation } : obj
      ),
    }));
  },

  reorderObjects: (id: string, newZIndex: number) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, zIndex: newZIndex } : obj
      ),
    }));
  },

  setObjectExpression: (id: string, expression: CharacterExpression) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, expression } : obj
      ),
    }));
  },

  setObjectAction: (id: string, action: CharacterAction) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, action } : obj
      ),
    }));
  },

  commitTransform: () => {
    get().saveSnapshot();
  },

  bringForward: (id: string) => {
    const { canvasObjects } = get();
    const obj = canvasObjects.find((o) => o.id === id);
    if (!obj) return;
    const maxZ = Math.max(...canvasObjects.map((o) => o.zIndex), obj.zIndex);
    set((state) => ({
      canvasObjects: state.canvasObjects.map((o) =>
        o.id === id ? { ...o, zIndex: maxZ + 1 } : o
      ),
    }));
  },

  sendBackward: (id: string) => {
    const { canvasObjects } = get();
    const obj = canvasObjects.find((o) => o.id === id);
    if (!obj) return;
    const minZ = Math.min(...canvasObjects.map((o) => o.zIndex), obj.zIndex);
    set((state) => ({
      canvasObjects: state.canvasObjects.map((o) =>
        o.id === id ? { ...o, zIndex: minZ - 1 } : o
      ),
    }));
  },

  setWatermark: (enabled: boolean, text: string) => {
    set({ watermarkEnabled: enabled, watermarkText: text });
  },

  // Asset Actions
  addCharacter: (character: Character) => {
    set((state) => ({ characters: [...state.characters, character] }));
  },

  addBackground: (background: Background) => {
    set((state) => ({ backgrounds: [...state.backgrounds, background] }));
  },

  addProp: (prop: Prop) => {
    set((state) => ({ props: [...state.props, prop] }));
  },

  addAudioClip: (audioClip: AudioClip) => {
    set((state) => ({ audioClips: [...state.audioClips, audioClip] }));
  },

  updateAudioClip: (id: string, patch: Partial<AudioClip>) => {
    set((state) => ({
      audioClips: state.audioClips.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },

  addTextElement: (text: TextElement) => {
    set((state) => ({ textElements: [...state.textElements, text] }));
  },

  deleteAsset: (type: 'character' | 'background' | 'prop' | 'audio', id: string) => {
    set((state) => {
      switch (type) {
        case 'character':
          return { characters: state.characters.filter((c) => c.id !== id) };
        case 'background':
          return { backgrounds: state.backgrounds.filter((b) => b.id !== id) };
        case 'prop':
          return { props: state.props.filter((p) => p.id !== id) };
        case 'audio':
          return { audioClips: state.audioClips.filter((a) => a.id !== id) };
        default:
          return state;
      }
    });
  },

  // History Actions
  undo: () => {
    const { history } = get();
    if (history.past.length === 0) return;

    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);

    const currentSnapshot: EditorSnapshot = {
      scenes: get().scenes,
      tracks: get().tracks,
      clips: get().clips,
      canvasObjects: get().canvasObjects,
      selectedObjectId: get().selectedObjectId,
      currentSceneId: get().currentSceneId,
    };

    set({
      scenes: previous.scenes,
      tracks: previous.tracks,
      clips: previous.clips,
      canvasObjects: previous.canvasObjects,
      selectedObjectId: previous.selectedObjectId,
      currentSceneId: previous.currentSceneId,
      history: {
        past: newPast,
        future: [currentSnapshot, ...history.future],
      },
    });
  },

  redo: () => {
    const { history } = get();
    if (history.future.length === 0) return;

    const next = history.future[0];
    const newFuture = history.future.slice(1);

    const currentSnapshot: EditorSnapshot = {
      scenes: get().scenes,
      tracks: get().tracks,
      clips: get().clips,
      canvasObjects: get().canvasObjects,
      selectedObjectId: get().selectedObjectId,
      currentSceneId: get().currentSceneId,
    };

    set({
      scenes: next.scenes,
      tracks: next.tracks,
      clips: next.clips,
      canvasObjects: next.canvasObjects,
      selectedObjectId: next.selectedObjectId,
      currentSceneId: next.currentSceneId,
      history: {
        past: [...history.past, currentSnapshot],
        future: newFuture,
      },
    });
  },

  saveSnapshot: () => {
    const { scenes, tracks, clips, canvasObjects, selectedObjectId, currentSceneId, history } = get();

    const snapshot: EditorSnapshot = {
      scenes: JSON.parse(JSON.stringify(scenes)),
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      canvasObjects: JSON.parse(JSON.stringify(canvasObjects)),
      selectedObjectId,
      currentSceneId,
    };

    const newPast = [...history.past, snapshot].slice(-MAX_HISTORY_SIZE);

    set({
      history: {
        past: newPast,
        future: [],
      },
    });
  },

  // UI Actions
  toggleTimeline: () => set((state) => ({ showTimeline: !state.showTimeline })),
  toggleAssetPanel: () => set((state) => ({ showAssetPanel: !state.showAssetPanel })),
  setActivePanel: (panel) => set({ activePanel: panel, showAssetPanel: panel !== null }),

  // Initialize
  initializeEditor: (projectId: string) => {
    const initialScene = createDefaultScene(0);
    initialScene.projectId = projectId;
    
    const initialTracks = createDefaultTracks(initialScene.id);
    
    set({
      scenes: [initialScene],
      currentSceneId: initialScene.id,
      tracks: initialTracks,
      clips: [],
      currentTime: 0,
      duration: initialScene.duration,
      isPlaying: false,
      canvasObjects: [],
      selectedObjectId: null,
      selectedObjectIds: [],
      history: { past: [], future: [] },
    });
  },

  resetEditor: () => {
    set({
      scenes: [],
      currentSceneId: null,
      tracks: [],
      clips: [],
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      playbackRate: 1,
      zoom: 1,
      fps: 30,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: 0,
      snapEnabled: true,
      autoKeyframe: false,
      markers: [],
      canvasObjects: [],
      selectedObjectId: null,
      selectedObjectIds: [],
      lipSyncLevel: 0,
      activeTool: 'select',
      characters: [],
      backgrounds: [],
      props: [],
      audioClips: [],
      textElements: [],
      history: { past: [], future: [] },
      showTimeline: true,
      showAssetPanel: false,
      activePanel: null,
      watermarkEnabled: true,
      watermarkText: 'AnimateX Studio',
    });
  },

  loadEditorState: (state: Partial<EditorState>) => {
    const currentSceneId = state.currentSceneId ?? get().currentSceneId;
    // Migrate old objects that have no sceneId so they never get lost.
    const canvasObjects = (state.canvasObjects ?? get().canvasObjects).map((obj) => ({
      ...obj,
      sceneId: obj.sceneId ?? currentSceneId ?? undefined,
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      opacity: obj.opacity ?? 1,
    }));
    set({
      ...state,
      canvasObjects,
      watermarkEnabled: state.watermarkEnabled ?? get().watermarkEnabled,
      watermarkText: state.watermarkText ?? get().watermarkText,
    });
  },

  getEditorState: () => {
    const state = get();
    return {
      scenes: state.scenes,
      tracks: state.tracks,
      clips: state.clips,
      canvasObjects: state.canvasObjects,
      characters: state.characters,
      backgrounds: state.backgrounds,
      props: state.props,
      audioClips: state.audioClips,
      textElements: state.textElements,
      currentSceneId: state.currentSceneId,
      selectedObjectId: state.selectedObjectId,
      currentTime: state.currentTime,
      watermarkEnabled: state.watermarkEnabled,
      watermarkText: state.watermarkText,
    };
  },
}));
