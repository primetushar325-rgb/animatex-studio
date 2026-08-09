'use client';

// ============================================================================
// Feature gating + credits (Free vs Pro) — single source of truth.
// Persisted in localStorage; swaps cleanly for a real billing source later.
// ============================================================================

import { useState, useEffect } from 'react';

export type Plan = 'free' | 'pro';

export interface GateRules {
  plan: Plan;
  credits: number;
  maxExportResolution: '720p' | '1080p';
  watermarkRemovable: boolean;
  maxCharacters: number;
}

const DEFAULT_CREDITS = 10;
const STORAGE_KEY = 'animatex-gate';

interface GateState {
  plan: Plan;
  credits: number;
}

function loadState(): GateState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GateState;
      return {
        plan: parsed.plan === 'pro' ? 'pro' : 'free',
        credits: typeof parsed.credits === 'number' ? parsed.credits : DEFAULT_CREDITS,
      };
    }
  } catch {
    // ignore
  }
  return { plan: 'free', credits: DEFAULT_CREDITS };
}

function persist(state: GateState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getGateRules(): GateRules {
  const s = loadState();
  return {
    plan: s.plan,
    credits: s.credits,
    maxExportResolution: s.plan === 'pro' ? '1080p' : '720p',
    watermarkRemovable: s.plan === 'pro',
    maxCharacters: s.plan === 'pro' ? 999 : 5,
  };
}

/** Consume credits for an AI call. Returns false (and does NOT consume) if insufficient. */
export function spendCredits(amount = 1): boolean {
  const s = loadState();
  if (s.plan === 'pro') return true; // pro = unlimited
  if (s.credits < amount) return false;
  persist({ ...s, credits: s.credits - amount });
  return true;
}

export function addCredits(amount: number) {
  const s = loadState();
  persist({ ...s, credits: s.credits + amount });
}

export function setPlan(plan: Plan) {
  const s = loadState();
  persist({ ...s, plan });
}

export function getCredits(): number {
  return loadState().credits;
}

export function isPro(): boolean {
  return loadState().plan === 'pro';
}

/** Force refresh of gate state (call after spendCredits so UI updates). */
export function bumpGateVersion(): void {
  try {
    window.dispatchEvent(new Event('animatex-gate-change'));
  } catch {
    // ignore
  }
}

/**
 * React hook — re-renders when gate state changes.
 */
export function useFeatureGate(): GateRules {
  const [rules, setRules] = useState<GateRules>(() => getGateRules());

  useEffect(() => {
    const refresh = () => setRules(getGateRules());
    window.addEventListener('storage', refresh);
    window.addEventListener('animatex-gate-change', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('animatex-gate-change', refresh);
    };
  }, []);

  return rules;
}
