import type {EffectsQuality} from '../systems/effectsQuality';

/** Bounded world-only budgets. Streaming, artwork and collision never change. */
export const VISUAL_QUALITY = {
  high: {density:2,pixels:4_000_000,maxEdge:3072,groundAnisotropy:8,modelAnisotropy:4,blurScale:.85,blurEdge:1280,blurPixels:900_000},
  normal: {density:1.5,pixels:2_400_000,maxEdge:2048,groundAnisotropy:4,modelAnisotropy:2,blurScale:.7,blurEdge:960,blurPixels:650_000},
  low: {density:1.1,pixels:1_200_000,maxEdge:2048,groundAnisotropy:2,modelAnisotropy:1,blurScale:.5,blurEdge:960,blurPixels:650_000},
} as const satisfies Record<EffectsQuality,unknown>;
