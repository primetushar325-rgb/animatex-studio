import type { LipSyncData, LipSyncFrame, MouthShape } from '@/types/animation';

// Basic lip sync analyzer using audio amplitude
// This is a simple implementation that doesn't require external APIs

interface AnalyzerOptions {
  sampleRate?: number;
  frameRate?: number;
  sensitivityThreshold?: number;
}

const defaultOptions: AnalyzerOptions = {
  sampleRate: 44100,
  frameRate: 30,
  sensitivityThreshold: 0.1,
};

// Map amplitude ranges to mouth shapes
function amplitudeToMouthShape(amplitude: number): MouthShape {
  if (amplitude < 0.05) return 'closed';
  if (amplitude < 0.15) return 'M';
  if (amplitude < 0.25) return 'E';
  if (amplitude < 0.35) return 'A';
  if (amplitude < 0.50) return 'O';
  if (amplitude < 0.70) return 'U';
  return 'open';
}

// Analyze audio buffer and generate lip sync data
export async function analyzeLipSync(
  audioBuffer: AudioBuffer,
  options: AnalyzerOptions = {}
): Promise<LipSyncData> {
  const opts = { ...defaultOptions, ...options };
  const frames: LipSyncFrame[] = [];

  // Get audio data from the first channel
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // Calculate samples per frame
  const samplesPerFrame = Math.floor(sampleRate / (opts.frameRate || 30));
  const totalFrames = Math.ceil(channelData.length / samplesPerFrame);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const startSample = frameIndex * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);
    
    // Calculate RMS amplitude for this frame
    let sumSquares = 0;
    for (let i = startSample; i < endSample; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / (endSample - startSample));
    
    // Normalize amplitude (0-1)
    const normalizedAmplitude = Math.min(rms * 3, 1);
    
    // Get mouth shape based on amplitude
    const mouthShape = amplitudeToMouthShape(normalizedAmplitude);
    
    // Calculate time for this frame
    const time = (frameIndex / (opts.frameRate || 30)) * 1000;
    
    frames.push({
      time,
      mouthShape,
      intensity: normalizedAmplitude,
    });
  }

  // Apply smoothing to prevent rapid mouth shape changes
  return smoothLipSyncData({ frames });
}

// Smooth lip sync data to prevent jittery animations
function smoothLipSyncData(data: LipSyncData): LipSyncData {
  const frames = data.frames;
  if (frames.length < 3) return data;

  const smoothedFrames: LipSyncFrame[] = [];
  
  for (let i = 0; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const next = frames[i + 1];
    
    // Simple averaging for intensity
    let intensity = curr.intensity;
    if (prev && next) {
      intensity = (prev.intensity + curr.intensity + next.intensity) / 3;
    }
    
    smoothedFrames.push({
      ...curr,
      intensity,
      mouthShape: amplitudeToMouthShape(intensity),
    });
  }

  return { frames: smoothedFrames };
}

// Create lip sync data from audio file
export async function createLipSyncFromFile(file: File): Promise<LipSyncData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const lipSyncData = await analyzeLipSync(audioBuffer);
        audioContext.close();
        resolve(lipSyncData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Create lip sync data from audio URL
export async function createLipSyncFromUrl(url: string): Promise<LipSyncData> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const lipSyncData = await analyzeLipSync(audioBuffer);
  audioContext.close();
  return lipSyncData;
}

// Get mouth shape at a specific time
export function getMouthShapeAtTime(data: LipSyncData, timeMs: number): MouthShape {
  if (data.frames.length === 0) return 'closed';
  
  // Find the closest frame
  let closestFrame = data.frames[0];
  let minDiff = Math.abs(data.frames[0].time - timeMs);
  
  for (const frame of data.frames) {
    const diff = Math.abs(frame.time - timeMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestFrame = frame;
    }
    // Early exit if we've passed the target time
    if (frame.time > timeMs) break;
  }
  
  return closestFrame.mouthShape;
}

// Interpolate between two mouth shapes
export function interpolateMouthShape(
  fromShape: MouthShape,
  toShape: MouthShape,
  progress: number
): MouthShape {
  // Define shape ordering for interpolation
  const shapeOrder: MouthShape[] = ['closed', 'M', 'E', 'A', 'I', 'O', 'U', 'open'];
  
  const fromIndex = shapeOrder.indexOf(fromShape);
  const toIndex = shapeOrder.indexOf(toShape);
  
  if (fromIndex === -1 || toIndex === -1) return fromShape;
  
  const interpolatedIndex = Math.round(fromIndex + (toIndex - fromIndex) * progress);
  return shapeOrder[Math.max(0, Math.min(interpolatedIndex, shapeOrder.length - 1))];
}
