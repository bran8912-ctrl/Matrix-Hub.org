// Minimal types for the vendored canvas-confetti UMD build
// (./canvas-confetti.js — see that file's header for provenance + licence).
// Only the surface burstConfetti() in src/lib/proving-ground.ts uses.

export interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  disableForReducedMotion?: boolean;
  zIndex?: number;
  scalar?: number;
}

declare const confetti: {
  (options?: ConfettiOptions): Promise<undefined> | undefined;
  reset: () => void;
};

export default confetti;
