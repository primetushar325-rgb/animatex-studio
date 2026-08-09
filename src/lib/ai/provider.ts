// AI Provider Abstraction
// This allows switching between different AI services without changing application code

import type { AIStoryScene, CharacterType, BackgroundCategory } from '@/types/animation';

export interface AIProvider {
  name: string;
  generateText: (prompt: string, options?: TextGenerationOptions) => Promise<string>;
  generateImage?: (prompt: string, options?: ImageGenerationOptions) => Promise<string>;
  generateSpeech?: (text: string, options?: SpeechGenerationOptions) => Promise<ArrayBuffer>;
  analyzeSpeech?: (audio: ArrayBuffer) => Promise<SpeechAnalysisResult>;
}

export interface TextGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  style?: string;
}

export interface SpeechGenerationOptions {
  voice?: string;
  speed?: number;
  language?: string;
}

export interface SpeechAnalysisResult {
  transcript: string;
  timing: { start: number; end: number; word: string }[];
}

// Story to scene parser
export interface StoryParseResult {
  scenes: AIStoryScene[];
  suggestedDuration: number;
}

// Mock AI Provider for development without API keys
export const mockAIProvider: AIProvider = {
  name: 'mock',
  
  generateText: async (prompt: string): Promise<string> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Return mock story scene response
    if (prompt.toLowerCase().includes('scene') || prompt.toLowerCase().includes('story')) {
      return JSON.stringify({
        scenes: [
          {
            order: 0,
            description: 'Opening scene',
            background: 'village',
            characters: [
              { type: 'boy', name: 'Hero', action: 'walk', position: { x: 200, y: 400 } }
            ],
            dialogue: [{ characterName: 'Hero', text: 'What a beautiful day!' }],
            duration: 3000,
          },
          {
            order: 1,
            description: 'Encounter',
            background: 'road',
            characters: [
              { type: 'boy', name: 'Hero', action: 'stand', position: { x: 200, y: 400 } },
              { type: 'dog', name: 'Dog', action: 'idle', position: { x: 500, y: 450 } },
            ],
            dialogue: [
              { characterName: 'Hero', text: 'Oh look, a dog!' }
            ],
            duration: 3000,
          },
        ],
      });
    }
    
    return 'AI response would appear here. Configure an AI provider to enable this feature.';
  },
  
  generateImage: async (prompt: string): Promise<string> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Return a placeholder
    return 'data:image/svg+xml,' + encodeURIComponent(`
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#E0E7FF"/>
        <text x="50%" y="50%" text-anchor="middle" fill="#4F46E5" font-size="24">
          AI Generated
        </text>
        <text x="50%" y="60%" text-anchor="middle" fill="#6366F1" font-size="14">
          ${prompt.slice(0, 30)}...
        </text>
      </svg>
    `);
  },
};

// Parse story text into scenes
export function parseStoryToScenes(storyText: string): StoryParseResult {
  // Simple sentence-based scene parsing
  const sentences = storyText
    .split(/[।.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const scenes: AIStoryScene[] = sentences.map((sentence, index) => {
    // Extract potential character mentions
    const characterPatterns: { pattern: RegExp; type: CharacterType }[] = [
      { pattern: /ছেলে|boy|বালক/i, type: 'boy' },
      { pattern: /মেয়ে|girl|বালিকা/i, type: 'girl' },
      { pattern: /পুরুষ|man|লোক/i, type: 'man' },
      { pattern: /মহিলা|woman|নারী/i, type: 'woman' },
      { pattern: /কুকুর|dog/i, type: 'dog' },
      { pattern: /বিড়াল|cat/i, type: 'cat' },
      { pattern: /গরু|cow/i, type: 'cow' },
    ];

    const backgroundPatterns: { pattern: RegExp; bg: BackgroundCategory }[] = [
      { pattern: /গ্রাম|village/i, bg: 'village' },
      { pattern: /শহর|city/i, bg: 'city' },
      { pattern: /স্কুল|school/i, bg: 'school' },
      { pattern: /বাজার|market/i, bg: 'market' },
      { pattern: /বাড়ি|house|ঘর/i, bg: 'house' },
      { pattern: /রাস্তা|road|পথ/i, bg: 'road' },
      { pattern: /নদী|river/i, bg: 'river' },
      { pattern: /পার্ক|park/i, bg: 'park' },
    ];

    const actionPatterns: { pattern: RegExp; action: string }[] = [
      { pattern: /হাঁট|walk|চল/i, action: 'walk' },
      { pattern: /দৌড়|run/i, action: 'run' },
      { pattern: /বস|sit/i, action: 'sit' },
      { pattern: /দাঁড়া|stand/i, action: 'stand' },
      { pattern: /লাফ|jump/i, action: 'jump' },
      { pattern: /কাঁদ|cry/i, action: 'cry' },
      { pattern: /হাস|laugh|smile/i, action: 'laugh' },
    ];

    // Detect characters
    const characters: AIStoryScene['characters'] = [];
    for (const cp of characterPatterns) {
      if (cp.pattern.test(sentence)) {
        // Find action for this character
        let action = 'idle';
        for (const ap of actionPatterns) {
          if (ap.pattern.test(sentence)) {
            action = ap.action;
            break;
          }
        }

        characters.push({
          type: cp.type,
          name: cp.type.charAt(0).toUpperCase() + cp.type.slice(1),
          action: action as AIStoryScene['characters'][0]['action'],
          position: { x: 200 + characters.length * 200, y: 400 },
        });
      }
    }

    // If no characters detected, add a default
    if (characters.length === 0) {
      characters.push({
        type: 'boy',
        name: 'Character',
        action: 'idle',
        position: { x: 300, y: 400 },
      });
    }

    // Detect background
    let background = 'village';
    for (const bp of backgroundPatterns) {
      if (bp.pattern.test(sentence)) {
        background = bp.bg;
        break;
      }
    }

    return {
      order: index,
      description: sentence,
      background,
      characters,
      dialogue: sentence.length > 10 ? [{ characterName: characters[0].name, text: sentence }] : undefined,
      duration: Math.max(3000, sentence.length * 100),
    };
  });

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return {
    scenes,
    suggestedDuration: totalDuration,
  };
}

// Active AI provider
let currentProvider: AIProvider = mockAIProvider;

export function setAIProvider(provider: AIProvider): void {
  currentProvider = provider;
}

export function getAIProvider(): AIProvider {
  return currentProvider;
}

// Generate story scenes
export async function generateStoryScenes(storyText: string): Promise<AIStoryScene[]> {
  const provider = getAIProvider();
  
  try {
    const response = await provider.generateText(storyText, {
      systemPrompt: 'You are an animation scene generator. Parse the story and generate scene data.',
    });
    
    const parsed = JSON.parse(response);
    return parsed.scenes || [];
  } catch {
    // Fallback to local parsing
    const result = parseStoryToScenes(storyText);
    return result.scenes;
  }
}

// Generate character image
export async function generateCharacterImage(description: string): Promise<string | null> {
  const provider = getAIProvider();
  
  if (!provider.generateImage) {
    return null;
  }
  
  return provider.generateImage(`2D cartoon character: ${description}`, {
    width: 512,
    height: 512,
    style: 'cartoon',
  });
}

// Generate background image
export async function generateBackgroundImage(description: string): Promise<string | null> {
  const provider = getAIProvider();
  
  if (!provider.generateImage) {
    return null;
  }
  
  return provider.generateImage(`2D cartoon background scene: ${description}`, {
    width: 1080,
    height: 1920,
    style: 'cartoon',
  });
}
