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
} from '@/types/animation';

type EditorTool = 'select' | 'move' | 'scale' | 'rotate' | 'text' | 'draw';

interface HistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

interface EditorSnapshot {
  scenes: Scene[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  selectedObjectId: string | null;
}

interface CanvasObject {
  id: string;
  type: 'character' | 'background' | 'prop' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
  assetId?: string;
  content?: string; // for text
  expression?: CharacterExpression;
  action?: CharacterAction;
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
  zoom: number;
  
  // Canvas
  canvasObjects: CanvasObject[];
  selectedObjectId: string | null;
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
  
  // Actions - Scenes
  addScene: (name?: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  setCurrentScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  
  // Actions - Timeline
  setCurrentTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setZoom: (zoom: number) => void;
  
  // Actions - Tracks
  addTrack: (type: TimelineTrack['type'], name: string) => void;
  deleteTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  
  // Actions - Clips
  addClip: (trackId: string, assetId: string, startTime: number, duration: number) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
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
  selectObject: (id: string | null) => void;
  setTool: (tool: EditorTool) => void;
  moveObject: (id: string, x: number, y: number) => void;
  scaleObject: (id: string, scaleX: number, scaleY: number) => void;
  rotateObject: (id: string, rotation: number) => void;
  reorderObjects: (id: string, newZIndex: number) => void;
  
  // Actions - Assets
  addCharacter: (character: Character) => void;
  addBackground: (background: Background) => void;
  addProp: (prop: Prop) => void;
  addAudioClip: (audioClip: AudioClip) => void;
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
  zoom: 1,
  canvasObjects: [],
  selectedObjectId: null,
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
    const { scenes, currentSceneId, tracks, clips } = get();
    if (scenes.length <= 1) return; // Don't delete last scene
    
    const newScenes = scenes.filter((s) => s.id !== sceneId);
    const newTracks = tracks.filter((t) => t.sceneId !== sceneId);
    const trackIds = tracks.filter((t) => t.sceneId === sceneId).map((t) => t.id);
    const newClips = clips.filter((c) => !trackIds.includes(c.trackId));
    
    set({
      scenes: newScenes.map((s, i) => ({ ...s, order: i })),
      tracks: newTracks,
      clips: newClips,
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

  trimClip: (clipId: string, trimStart: number, trimEnd: number) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId ? { ...c, trimStart, trimEnd } : c
      ),
    }));
  },

  splitClip: (clipId: string, splitTime: number) => {
    const { clips } = get();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || splitTime <= clip.startTime || splitTime >= clip.endTime) return;
    
    const firstDuration = splitTime - clip.startTime;
    const secondDuration = clip.endTime - splitTime;
    
    const firstClip: TimelineClip = {
      ...clip,
      endTime: splitTime,
      duration: firstDuration,
    };
    
    const secondClip: TimelineClip = {
      ...clip,
      id: uuidv4(),
      startTime: splitTime,
      duration: secondDuration,
      keyframes: [],
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
    const newKeyframe: Keyframe = {
      id: uuidv4(),
      clipId,
      time,
      properties,
      easing: 'ease-in-out',
    };
    
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, keyframes: [...c.keyframes, newKeyframe].sort((a, b) => a.time - b.time) }
          : c
      ),
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
    const newObj: CanvasObject = { ...obj, id: uuidv4() };
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
    }));
    get().saveSnapshot();
  },

  selectObject: (id: string | null) => set({ selectedObjectId: id }),

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
      selectedObjectId: get().selectedObjectId,
    };
    
    set({
      scenes: previous.scenes,
      tracks: previous.tracks,
      clips: previous.clips,
      selectedObjectId: previous.selectedObjectId,
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
      selectedObjectId: get().selectedObjectId,
    };
    
    set({
      scenes: next.scenes,
      tracks: next.tracks,
      clips: next.clips,
      selectedObjectId: next.selectedObjectId,
      history: {
        past: [...history.past, currentSnapshot],
        future: newFuture,
      },
    });
  },

  saveSnapshot: () => {
    const { scenes, tracks, clips, selectedObjectId, history } = get();
    
    const snapshot: EditorSnapshot = {
      scenes: JSON.parse(JSON.stringify(scenes)),
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      selectedObjectId,
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
      zoom: 1,
      canvasObjects: [],
      selectedObjectId: null,
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
    });
  },

  loadEditorState: (state: Partial<EditorState>) => {
    set(state);
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
    };
  },
}));
