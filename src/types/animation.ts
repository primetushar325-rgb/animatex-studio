// Core Animation Types

export type CanvasRatio = '9:16' | '16:9' | '1:1';

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  thumbnail?: string;
  canvasRatio: CanvasRatio;
  duration: number; // in milliseconds
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'published' | 'archived';
  fps: number;
  width: number;
  height: number;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  order: number;
  duration: number;
  backgroundColor: string;
  backgroundId?: string;
  cameraSettings: CameraSettings;
  transition: Transition;
}

export interface CameraSettings {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  keyframes: CameraKeyframe[];
}

export interface CameraKeyframe {
  time: number;
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  shake?: number;
}

export interface Transition {
  type: 'none' | 'fade' | 'crossfade' | 'slide' | 'zoom';
  duration: number;
}

// Timeline Elements
export interface TimelineTrack {
  id: string;
  sceneId: string;
  type: 'character' | 'background' | 'prop' | 'text' | 'voice' | 'music' | 'sfx';
  name: string;
  order: number;
  muted: boolean;
  locked: boolean;
  visible: boolean;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  sceneId: string;
  assetId: string;
  startTime: number;
  endTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume?: number;
  keyframes: Keyframe[];
}

export interface Keyframe {
  id: string;
  clipId: string;
  time: number;
  properties: KeyframeProperties;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface KeyframeProperties {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  expression?: CharacterExpression;
  action?: CharacterAction;
  mouthShape?: MouthShape;
}

// Characters
export interface Character {
  id: string;
  projectId: string;
  name: string;
  type: CharacterType;
  imageUrl: string;
  thumbnailUrl?: string;
  rigging?: CharacterRigging;
  defaultExpression: CharacterExpression;
  defaultAction: CharacterAction;
  isCustom: boolean;
}

export type CharacterType = 
  | 'boy' | 'girl' | 'child' | 'man' | 'woman' 
  | 'old-man' | 'old-woman' | 'dog' | 'cat' 
  | 'bird' | 'cow' | 'goat' | 'custom';

export type CharacterExpression = 
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'scared' 
  | 'surprised' | 'laughing' | 'crying' | 'thinking' | 'sleepy';

export type CharacterAction = 
  | 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'stand' 
  | 'wave' | 'talk' | 'point' | 'clap' | 'cry' | 'laugh' 
  | 'dance' | 'fall';

export type MouthShape = 
  | 'closed' | 'A' | 'E' | 'I' | 'O' | 'U' | 'M' | 'open';

export interface CharacterRigging {
  head: BoneTransform;
  body: BoneTransform;
  upperArmLeft: BoneTransform;
  lowerArmLeft: BoneTransform;
  handLeft: BoneTransform;
  upperArmRight: BoneTransform;
  lowerArmRight: BoneTransform;
  handRight: BoneTransform;
  upperLegLeft: BoneTransform;
  lowerLegLeft: BoneTransform;
  footLeft: BoneTransform;
  upperLegRight: BoneTransform;
  lowerLegRight: BoneTransform;
  footRight: BoneTransform;
}

export interface BoneTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// Canvas Objects (elements placed on the stage)
export type CanvasObjectType = 'character' | 'background' | 'prop' | 'text';

export type MotionPreset =
  | 'none'
  | 'fade-in'
  | 'fade-out'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'pop-in'
  | 'bounce'
  | 'zoom-in'
  | 'spin-in';

export interface CanvasObject {
  id: string;
  /** Scene this object belongs to. Filled automatically when added. */
  sceneId?: string;
  type: CanvasObjectType;
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
  /** Text content for text objects */
  content?: string;
  expression?: CharacterExpression;
  action?: CharacterAction;
  characterType?: CharacterType;
  /** Custom uploaded image (Cloudinary URL) */
  imageUrl?: string;
  /** Human friendly name (asset name) */
  name?: string;
  /** Optional tint for props/backgrounds */
  color?: string;
  /** Font size override for text objects */
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  /** Entrance / exit motion preset, animated during playback */
  motion?: MotionPreset;
  /** Scene-time (ms) when the motion should start (default 0) */
  motionStart?: number;
}

// Backgrounds
export interface Background {
  id: string;
  projectId: string;
  name: string;
  category: BackgroundCategory;
  imageUrl: string;
  thumbnailUrl?: string;
  isCustom: boolean;
}

export type BackgroundCategory = 
  | 'village' | 'city' | 'school' | 'market' | 'house' 
  | 'bedroom' | 'park' | 'river' | 'farm' | 'road' | 'custom';

// Props
export interface Prop {
  id: string;
  projectId: string;
  name: string;
  category: PropCategory;
  imageUrl: string;
  thumbnailUrl?: string;
  isCustom: boolean;
}

export type PropCategory = 
  | 'furniture' | 'electronics' | 'food' | 'nature' 
  | 'vehicle' | 'accessory' | 'custom';

// Text
export interface TextElement {
  id: string;
  sceneId: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  startTime: number;
  endTime: number;
  animation?: TextAnimation;
}

export type TextAnimation = 
  | 'none' | 'fade-in' | 'fade-out' | 'typewriter' 
  | 'bounce' | 'slide-in' | 'slide-out';

// Audio
export interface AudioClip {
  id: string;
  projectId: string;
  name: string;
  type: 'voice' | 'music' | 'sfx';
  fileUrl: string;
  duration: number;
  waveformData?: number[];
  transcript?: string;
  lipSyncData?: LipSyncData;
}

export interface LipSyncData {
  frames: LipSyncFrame[];
}

export interface LipSyncFrame {
  time: number;
  mouthShape: MouthShape;
  intensity: number;
}

// Subtitles
export interface Subtitle {
  id: string;
  sceneId: string;
  startTime: number;
  endTime: number;
  text: string;
  style: SubtitleStyle;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
}

// Dialogue / Script
export interface DialogueLine {
  id: string;
  sceneId: string;
  characterId: string;
  text: string;
  voiceClipId?: string;
  startTime: number;
  endTime: number;
}

// AI Features
export interface AIGenerationRequest {
  type: 'story' | 'character' | 'background' | 'props' | 'voice';
  prompt: string;
  options?: Record<string, unknown>;
}

export interface AIStoryScene {
  order: number;
  description: string;
  background: string;
  characters: {
    id?: string;
    type: CharacterType;
    name: string;
    action: CharacterAction;
    position: { x: number; y: number };
  }[];
  dialogue?: {
    characterName: string;
    text: string;
  }[];
  duration: number;
}

// Project Templates
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: TemplateCategory;
  canvasRatio: CanvasRatio;
  scenes: Partial<Scene>[];
}

export type TemplateCategory = 
  | 'village-story' | 'kids-cartoon' | 'funny' | 'emotional' 
  | 'animal-story' | 'educational' | 'shorts' | 'narrator';

// Export Settings
export interface ExportSettings {
  format: 'mp4' | 'webm';
  resolution: '480p' | '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  quality: 'low' | 'medium' | 'high';
  includeAudio: boolean;
}

// Version History
export interface ProjectVersion {
  id: string;
  projectId: string;
  timestamp: number;
  description?: string;
  snapshotUrl: string;
}

// User Settings
export interface UserSettings {
  performanceMode: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  defaultCanvasRatio: CanvasRatio;
  language: 'en' | 'bn';
}

// Feature Flags
export interface FeatureFlags {
  aiAnimation: boolean;
  aiVoice: boolean;
  aiCharacter: boolean;
  aiBackground: boolean;
  lipSync: boolean;
  export: boolean;
  voiceRecording: boolean;
}

// Usage Limits
export interface UsageLimits {
  maxProjects: number;
  maxAIRequestsPerDay: number;
  maxExportsPerDay: number;
  maxStorageMB: number;
}

// Activity Log
export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  details?: Record<string, unknown>;
  timestamp: number;
  ip?: string;
}

export type ActivityAction = 
  | 'login' | 'logout' | 'project_create' | 'project_edit' 
  | 'project_delete' | 'export' | 'voice_upload' | 'voice_record' 
  | 'ai_request' | 'project_import' | 'project_restore';

// Admin Types
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalScenes: number;
  totalExports: number;
  aiUsage: number;
  storageUsageBytes: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  createdAt: number;
  expiresAt?: number;
}
