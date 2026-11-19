// The Clubhouse — Phase 3 shared lib (Reel Foundry trial studio + MTX 101
// Classroom).
//
// DESIGN LAW: everything in this file runs on the visitor's own device.
// No uploads, no server calls with visitor media, no accounts. The only
// network fetches are (a) the transcription model file — a public model
// binary, fetched once and cached in the visitor's browser — and (b) the
// open-source runtime assets served from this site itself. Visitor audio
// and video NEVER leave the browser.
//
// ---------------------------------------------------------------------------
// CLASSROOM PROGRESS CONTRACT (for Phase 1 — Clubhouse Passport)
// ---------------------------------------------------------------------------
// Classroom progress lives in localStorage under the key:
//
//     mh_classroom_v1
//
// Shape (JSON):
// {
//   "version": 1,
//   "lessons": {
//     "lesson-1": {
//       "seen": [0, 1, 2],            // slide indexes viewed (deck order)
//       "totalSlides": 7,             // content + quiz + completion slides
//       "completed": true,
//       "completedAt": "2026-11-18T…Z" | null,
//       "quizAnswered": 2,
//       "quizCorrect": 2
//     }, …
//   },
//   "updatedAt": "2026-11-18T…Z"
// }
//
// Lesson ids are "lesson-1" … "lesson-12" (see lessons-data.ts).
// A lesson is "completed" when every slide has been viewed AND every quiz
// question answered (right or wrong — the quiz is a self-check, not a gate).
// Phase 1's Passport should read this via getClassroomSummary() below or
// parse the key directly; the key and shape above are the stable contract.
// ---------------------------------------------------------------------------

// ===========================================================================
// Captions
// ===========================================================================

export interface CaptionCue {
  /** Seconds, relative to the start of the trimmed clip. */
  start: number;
  /** Seconds, relative to the start of the trimmed clip. */
  end: number;
  text: string;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" (VTT). */
export function formatCaptionTime(seconds: number, decimalSep: ',' | '.'): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)}${decimalSep}${pad(ms, 3)}`;
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return (
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatCaptionTime(c.start, ',')} --> ${formatCaptionTime(c.end, ',')}\n${c.text.trim()}\n`,
      )
      .join('\n') + '\n'
  );
}

export function cuesToVtt(cues: CaptionCue[]): string {
  return (
    'WEBVTT\n\n' +
    cues
      .map(
        (c) =>
          `${formatCaptionTime(c.start, '.')} --> ${formatCaptionTime(c.end, '.')}\n${c.text.trim()}\n`,
      )
      .join('\n') +
    '\n'
  );
}

function parseTimecode(tc: string): number {
  const m = tc.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) return NaN;
  const [, h, min, sec, ms] = m;
  return (
    (h ? parseInt(h, 10) * 3600 : 0) +
    parseInt(min, 10) * 60 +
    parseInt(sec, 10) +
    parseInt(ms.padEnd(3, '0'), 10) / 1000
  );
}

/** Minimal built-in SRT/VTT parser — fallback if the captions library fails to load. */
export function parseCaptionTextFallback(text: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx < 0) continue;
    const [a, b] = lines[arrowIdx].split('-->').map((x) => x.trim().split(/\s+/)[0]);
    const start = parseTimecode(a);
    const end = parseTimecode(b);
    const body = lines.slice(arrowIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && body) cues.push({ start, end, text: body });
  }
  return cues.sort((x, y) => x.start - y.start);
}

/**
 * Parse an SRT or VTT file's text into cues. Uses the media-captions
 * library (MIT, by Vidstack) when it loads; falls back to the built-in
 * parser above so imports never hard-fail.
 */
export async function parseCaptionText(text: string, kind: 'srt' | 'vtt'): Promise<CaptionCue[]> {
  try {
    const mc: any = await import('media-captions');
    if (typeof mc.parseText === 'function') {
      const out: any = await mc.parseText(text, { type: kind });
      const raw: any[] = out?.cues ?? [];
      const cues: CaptionCue[] = raw
        .map((c: any) => ({
          start: Number(c.startTime ?? c.start),
          end: Number(c.endTime ?? c.end),
          text: String(c.text ?? '').replace(/<[^>]+>/g, '').trim(),
        }))
        .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.text);
      if (cues.length) return cues.sort((a, b) => a.start - b.start);
    }
  } catch {
    /* fall through to the built-in parser */
  }
  return parseCaptionTextFallback(text);
}

// ===========================================================================
// Whisper (whisper.cpp WASM) — on-device transcription
// ===========================================================================
//
// Runtime: the official whisper.cpp WASM build (MIT), vendored unmodified
// at /clubhouse/studio/libwhisper.js (the Emscripten bundle with the WASM
// inlined — the same build the project's own ggml.ai demo serves,
// byte-identical). It MUST live under /clubhouse/studio/: the runtime's
// worker threads load this same file as their worker script, and a
// cross-origin-isolated page may only spawn workers whose script response
// carries COEP headers — which the coi-serviceworker (scoped to
// /clubhouse/studio/) adds. When the runtime lived outside that scope,
// the workers were blocked and transcription silently produced nothing.
// Model: ggml-tiny.en-q5_1 (~31 MB), served same-origin from
// /foundry/whisper/ when present, otherwise fetched once from the
// whisper.cpp Hugging Face repo and cached in IndexedDB on the device.
//
// The build is multi-threaded and needs SharedArrayBuffer, i.e. a
// cross-origin-isolated page. Static hosting can't set COOP/COEP headers,
// so the studio page enables isolation with the coi-serviceworker trick
// (MIT, Guido Zuidhof) scoped to /clubhouse/studio/ only — see
// enableCrossOriginIsolation(). If isolation is unavailable, transcription
// reports that honestly instead of faking a result.

export const WHISPER_MODEL_NAME = 'ggml-tiny.en-q5_1.bin';
export const WHISPER_MODEL_URLS = [
  `/foundry/whisper/${WHISPER_MODEL_NAME}`,
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_MODEL_NAME}`,
];
export const WHISPER_RUNTIME_URL = '/clubhouse/studio/libwhisper.js';
export const WHISPER_SAMPLE_RATE = 16000;

export type WhisperPhase =
  | 'idle'
  | 'runtime'
  | 'model'
  | 'ready'
  | 'transcribing'
  | 'needs-isolation'
  | 'error';

interface WhisperState {
  runtimeReady: boolean;
  modelLoaded: boolean;
  instance: number | null;
  lines: string[];
  cues: CaptionCue[];
}

const wstate: WhisperState = {
  runtimeReady: false,
  modelLoaded: false,
  instance: null,
  lines: [],
  cues: [],
};

const SEGMENT_RE =
  /^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.*)$/;

function hms(h: string, m: string, s: string, ms: string): number {
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
}

function collectWhisperLine(line: string) {
  const m = SEGMENT_RE.exec(line.trim());
  if (m) {
    const text = m[9].trim();
    if (text) {
      wstate.cues.push({
        start: hms(m[1], m[2], m[3], m[4]),
        end: hms(m[5], m[6], m[7], m[8]),
        text,
      });
    }
  }
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mh-foundry', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('models');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetModel(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get(key);
      req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbPutModel(key: string, buf: ArrayBuffer): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').put(buf, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* cache is best-effort */
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: (pct: number) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`model fetch failed: ${res.status}`);
  const total = Number(res.headers.get('Content-Length') ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) onProgress(Math.round((received / total) * 100));
    }
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return buf.buffer;
}

/**
 * Load the whisper.cpp runtime + model. Throws { code: 'needs-isolation' }
 * when the page is not cross-origin isolated (the pthread build cannot
 * start without SharedArrayBuffer).
 */
export async function loadWhisper(onPhase: (phase: WhisperPhase, pct?: number) => void): Promise<void> {
  const w = window as any;
  if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
    onPhase('needs-isolation');
    throw Object.assign(new Error('cross-origin isolation required'), { code: 'needs-isolation' });
  }

  if (!wstate.runtimeReady) {
    onPhase('runtime');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('whisper runtime timed out')), 30000);
      w.Module = {
        print: (line: string) => collectWhisperLine(line),
        printErr: () => {},
        setStatus: () => {},
        monitorRunDependencies: () => {},
        onRuntimeInitialized: () => {
          clearTimeout(timeout);
          resolve();
        },
      };
      const script = document.createElement('script');
      script.src = WHISPER_RUNTIME_URL;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('whisper runtime failed to load'));
      };
      document.head.appendChild(script);
    });
    wstate.runtimeReady = true;
  }

  if (!wstate.modelLoaded) {
    onPhase('model', 0);
    let buf = await idbGetModel(WHISPER_MODEL_NAME);
    if (!buf) {
      let lastErr: unknown = null;
      for (const url of WHISPER_MODEL_URLS) {
        try {
          buf = await fetchWithProgress(url, (pct) => onPhase('model', pct));
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!buf) throw lastErr ?? new Error('model download failed');
      void idbPutModel(WHISPER_MODEL_NAME, buf);
    } else {
      onPhase('model', 100);
    }
    const M = (window as any).Module;
    try {
      M.FS_unlink('whisper.bin');
    } catch {
      /* not present yet */
    }
    M.FS_createDataFile('/', 'whisper.bin', new Uint8Array(buf), true, true);
    wstate.modelLoaded = true;
  }

  if (wstate.instance == null) {
    const M = (window as any).Module;
    const inst = M.init('whisper.bin');
    if (!inst) throw new Error('whisper failed to initialise with the model');
    wstate.instance = inst;
  }
  onPhase('ready');
}

/**
 * Transcribe 16 kHz mono PCM (Float32) on-device. Resolves with the real
 * cues whisper produced — never a placeholder. Blocking call (the WASM
 * build runs synchronously), so callers should paint a "transcribing"
 * state first and yield a tick before invoking.
 */
export async function transcribePcm(pcm: Float32Array): Promise<CaptionCue[]> {
  if (wstate.instance == null) throw new Error('whisper is not loaded');
  const M = (window as any).Module;
  wstate.cues = [];
  const threads = Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4));
  const ret = M.full_default(wstate.instance, pcm, 'en', threads, false);
  if (ret) throw new Error(`whisper returned ${ret}`);
  return [...wstate.cues].sort((a, b) => a.start - b.start);
}

/**
 * Enable cross-origin isolation for the studio page via the
 * coi-serviceworker (MIT). The service worker lives at
 * /clubhouse/studio/coi-serviceworker.js, so its scope is ONLY
 * /clubhouse/studio/ — no other page is affected. Loading the script
 * registers the worker and reloads the page once; call this from a user
 * gesture and expect a reload.
 */
export function enableCrossOriginIsolation(): void {
  if (sessionStorage.getItem('mh_foundry_coi_attempt')) {
    throw new Error('isolation reload already attempted');
  }
  sessionStorage.setItem('mh_foundry_coi_attempt', '1');
  const script = document.createElement('script');
  script.src = '/clubhouse/studio/coi-serviceworker.js';
  document.head.appendChild(script);
}

export function isolationAlreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem('mh_foundry_coi_attempt') === '1';
  } catch {
    return false;
  }
}

/**
 * Extract a clip's audio track as 16 kHz mono Float32 PCM, sliced to
 * [startSec, endSec]. Works for audio and video files the browser can
 * decode. Everything happens locally via Web Audio.
 */
export async function extractPcmSlice(
  file: Blob,
  startSec: number,
  endSec: number,
): Promise<Float32Array> {
  const raw = await file.arrayBuffer();
  const decodeCtx = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const decoded = await decodeCtx.decodeAudioData(raw.slice(0));
    const frames = Math.max(1, Math.floor(decoded.duration * decoded.sampleRate));
    const offline = new OfflineAudioContext(1, frames, decoded.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    const merger = offline.createChannelMerger(1);
    src.connect(merger);
    merger.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const channel = rendered.getChannelData(0);
    const from = Math.max(0, Math.floor(startSec * WHISPER_SAMPLE_RATE));
    const to = Math.min(channel.length, Math.ceil(endSec * WHISPER_SAMPLE_RATE));
    return channel.slice(from, Math.max(from + 1, to));
  } finally {
    void decodeCtx.close();
  }
}

// ===========================================================================
// Trimmed-clip export
// ===========================================================================

export interface TrimExportResult {
  blob: Blob;
  filename: string;
  engine: string;
}

/**
 * Trim [startSec, endSec] out of a video file and re-encode to MP4 with
 * WebAV (MIT) on WebCodecs. Throws if the browser has no H.264 WebCodecs
 * encoder — the caller then offers the MediaRecorder fallback.
 */
export async function exportTrimmedMp4(
  file: File,
  startSec: number,
  endSec: number,
): Promise<TrimExportResult> {
  const av: any = await import('@webav/av-cliper');
  const clip = new av.MP4Clip(file.stream());
  await clip.ready;
  const durationUs = clip.meta.duration as number;
  let piece = clip;
  if (endSec * 1e6 < durationUs - 1) {
    const [pre] = await piece.split(Math.round(endSec * 1e6));
    piece = pre;
  }
  if (startSec > 0.01) {
    const [, post] = await piece.split(Math.round(startSec * 1e6));
    piece = post;
  }
  const sprite = new av.OffscreenSprite(piece);
  try {
    sprite.time.offset = 0;
    sprite.time.duration = piece.meta.duration;
  } catch {
    /* sprite defaults to the clip's own duration */
  }
  const combinator = new av.Combinator({
    width: piece.meta.width,
    height: piece.meta.height,
  });
  await combinator.addSprite(sprite, { main: true });
  const stream: ReadableStream = combinator.output();
  const blob = await new Response(stream).blob();
  if (blob.size === 0) throw new Error('WebAV produced an empty file');
  return { blob, filename: 'foundry-trimmed.mp4', engine: 'WebAV (WebCodecs, on-device)' };
}

interface ElementAudioTap {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
}

/**
 * One audio tap per video element, cached for the page session. The
 * browser allows createMediaElementSource() only ONCE per element —
 * calling it again (a second export in the same session, e.g. a plain
 * trim after a captioned export) throws "HTMLMediaElement already
 * connected previously". So the tap is created lazily on first use and
 * reused: the source stays connected to the context destination (the
 * element stays audible, exactly as if no tap existed), and each export
 * adds — then removes — its own MediaStreamDestination edge.
 */
const elementAudioTaps = new WeakMap<HTMLVideoElement, ElementAudioTap>();

function getElementAudioTap(video: HTMLVideoElement): ElementAudioTap {
  let tap = elementAudioTaps.get(video);
  if (!tap) {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    source.connect(ctx.destination);
    tap = { ctx, source };
    elementAudioTaps.set(video, tap);
  }
  return tap;
}

/** Painted over each recorded frame, after the video frame itself. */
export type FramePainter = (
  ctx2d: CanvasRenderingContext2D,
  width: number,
  height: number,
  /** Seconds since the start of the recorded (trimmed) range. */
  relTime: number,
) => void;

/**
 * Shared real-time recording machinery behind both WebM exports: plays
 * the chosen range once while a canvas + MediaRecorder capture it to
 * WebM. Slower (real-time) but works in any browser with MediaRecorder.
 * The video element's audio is routed through a temporary AudioContext
 * for the recording, then restored. An optional painter can draw over
 * every frame (the caption burn-in uses it).
 */
async function recordRangeToWebM(
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  onProgress: ((pct: number) => void) | undefined,
  paintFrame: FramePainter | undefined,
  filename: string,
  engine: string,
): Promise<TrimExportResult> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) throw new Error('canvas unavailable');

  const tap = getElementAudioTap(video);
  if (tap.ctx.state === 'suspended') void tap.ctx.resume();
  const dest = tap.ctx.createMediaStreamDestination();
  tap.source.connect(dest);

  const stream = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  let raf = 0;
  const draw = () => {
    ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (paintFrame) {
      paintFrame(ctx2d, canvas.width, canvas.height, Math.max(0, video.currentTime - startSec));
    }
    if (!video.paused && !video.ended) raf = requestAnimationFrame(draw);
  };

  try {
    video.currentTime = startSec;
    await new Promise<void>((r) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        r();
      };
      video.addEventListener('seeked', onSeeked);
    });
    recorder.start(250);
    await video.play();
    draw();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = video.currentTime;
        onProgress?.(
          Math.min(100, Math.round(((t - startSec) / Math.max(0.1, endSec - startSec)) * 100)),
        );
        if (t >= endSec || video.ended) resolve();
        else setTimeout(tick, 120);
      };
      tick();
    });
  } finally {
    cancelAnimationFrame(raf);
    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    try {
      tap.source.disconnect(dest);
    } catch {
      /* edge already gone */
    }
  }
  const blob = await done;
  return { blob, filename, engine };
}

/**
 * Fallback trim export: the trimmed range as a plain WebM, recorded in
 * real time via recordRangeToWebM. Captions are not in the picture —
 * pair it with the .SRT/.VTT file, or use the captioned export below.
 */
export async function exportTrimmedWebM(
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  onProgress?: (pct: number) => void,
): Promise<TrimExportResult> {
  return recordRangeToWebM(
    video,
    startSec,
    endSec,
    onProgress,
    undefined,
    'foundry-trimmed.webm',
    'MediaRecorder fallback (on-device)',
  );
}

// ===========================================================================
// Caption burn-in (canvas + MediaRecorder — the proven WebM path)
// ===========================================================================

/** The caption style choices, mirroring the studio's preview controls. */
export interface BurnInStyle {
  size: 'standard' | 'large';
  position: 'bottom' | 'top';
  background: boolean;
  /** Which named look to draw with — see BURN_IN_PRESETS. */
  preset: BurnInPresetId;
}

export type BurnInPresetId = 'classic' | 'bold' | 'minimal';

/**
 * A named caption look for the burn-in. The studio's preview overlay is
 * styled from these same definitions, so the look picked on the page is
 * the look that burns. Each look has its own backing treatment, used when
 * the style's `background` toggle is on: Classic and Bold draw a dark
 * block behind the text; Minimal draws no block and gives the text a
 * dark outline instead.
 */
export interface BurnInPreset {
  id: BurnInPresetId;
  name: string;
  /** Plain one-liner shown beside the picker. */
  blurb: string;
  fontWeight: number;
  /** Multiplier on the size-derived font size. */
  fontScale: number;
  /** Multiplier on the backing block's padding ('block' looks only). */
  padScale: number;
  backingStyle: 'block' | 'outline';
  /** Fill for the backing block ('block' looks only). */
  backingColor: string;
  /** Stroke colour drawn around the glyphs ('outline' look only). */
  outlineColor: string;
}

export const BURN_IN_PRESETS: BurnInPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'White text on a dark block — the standard caption look.',
    fontWeight: 600,
    fontScale: 1,
    padScale: 1,
    backingStyle: 'block',
    backingColor: 'rgba(0, 0, 0, 0.75)',
    outlineColor: 'rgba(0, 0, 0, 0.85)',
  },
  {
    id: 'bold',
    name: 'Bold',
    blurb: 'Bigger, heavier text on a stronger block — made to read on busy footage.',
    fontWeight: 800,
    fontScale: 1.12,
    padScale: 1.15,
    backingStyle: 'block',
    backingColor: 'rgba(0, 0, 0, 0.88)',
    outlineColor: 'rgba(0, 0, 0, 0.9)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'No block — lighter text with a dark outline, for quiet footage.',
    fontWeight: 500,
    fontScale: 0.94,
    padScale: 1,
    backingStyle: 'outline',
    backingColor: 'rgba(0, 0, 0, 0.75)',
    outlineColor: 'rgba(0, 0, 0, 0.9)',
  },
];

export function getBurnInPreset(id: BurnInPresetId | undefined): BurnInPreset {
  return BURN_IN_PRESETS.find((p) => p.id === id) ?? BURN_IN_PRESETS[0];
}

/**
 * Draw one caption onto a recorded frame, styled to match the on-page
 * preview: white text in the chosen look, centred, word-wrapped, with
 * the look's backing treatment when the background toggle is on. Font
 * size scales with the frame height the same way the preview scales
 * with the player height (standard ≈ 4.6% of height, large ≈ 6.2%,
 * then the look's own scale).
 */
export function drawBurnedCaption(
  ctx2d: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  style: BurnInStyle,
): void {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const preset = getBurnInPreset(style.preset);
  const fontPx = Math.max(
    13,
    Math.round(height * (style.size === 'large' ? 0.062 : 0.046) * preset.fontScale),
  );
  ctx2d.font = `${preset.fontWeight} ${fontPx}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const maxTextWidth = width * 0.86;
  const words = clean.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (line && ctx2d.measureText(trial).width > maxTextWidth) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);

  const lineHeight = fontPx * 1.28;
  const padX = fontPx * 0.6 * preset.padScale;
  const padY = fontPx * 0.32 * preset.padScale;
  const textWidth = Math.max(...lines.map((l) => ctx2d.measureText(l).width));
  const blockW = Math.min(width * 0.94, textWidth + padX * 2);
  const blockH = lines.length * lineHeight + padY * 2;
  const blockX = (width - blockW) / 2;
  const blockY =
    style.position === 'bottom' ? height - height * 0.055 - blockH : height * 0.04;

  if (style.background && preset.backingStyle === 'block') {
    ctx2d.fillStyle = preset.backingColor;
    const radius = fontPx * 0.3;
    ctx2d.beginPath();
    if (typeof ctx2d.roundRect === 'function') {
      ctx2d.roundRect(blockX, blockY, blockW, blockH, radius);
    } else {
      ctx2d.rect(blockX, blockY, blockW, blockH);
    }
    ctx2d.fill();
  }
  const outlined = style.background && preset.backingStyle === 'outline';
  if (outlined) {
    ctx2d.strokeStyle = preset.outlineColor;
    ctx2d.lineWidth = Math.max(2, fontPx / 9);
    ctx2d.lineJoin = 'round';
    ctx2d.miterLimit = 2;
  }
  ctx2d.fillStyle = '#ffffff';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'top';
  lines.forEach((l, i) => {
    const y = blockY + padY + i * lineHeight;
    if (outlined) ctx2d.strokeText(l, width / 2, y, maxTextWidth + padX);
    ctx2d.fillText(l, width / 2, y, maxTextWidth + padX);
  });
}

/**
 * Caption burn-in export: records the trimmed range in real time through
 * the same canvas + MediaRecorder machinery as the plain WebM trim, with
 * the active caption drawn into every frame in the chosen preview style.
 * Cue times are relative to the trim start — the same convention as the
 * preview and the caption files. The result is a WebM whose captions are
 * part of the picture.
 */
export async function exportBurnedWebM(
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  cues: CaptionCue[],
  style: BurnInStyle,
  onProgress?: (pct: number) => void,
): Promise<TrimExportResult> {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  return recordRangeToWebM(
    video,
    startSec,
    endSec,
    onProgress,
    (ctx2d, w, h, relTime) => {
      const cue = sorted.find((c) => relTime >= c.start && relTime < c.end);
      if (cue) drawBurnedCaption(ctx2d, w, h, cue.text, style);
    },
    'foundry-captioned.webm',
    'Canvas + MediaRecorder burn-in (on-device)',
  );
}

// ===========================================================================
// Classroom progress (see the contract at the top of this file)
// ===========================================================================

export const CLASSROOM_STORAGE_KEY = 'mh_classroom_v1';

export interface LessonProgress {
  seen: number[];
  totalSlides: number;
  completed: boolean;
  completedAt: string | null;
  quizAnswered: number;
  quizCorrect: number;
}

export interface ClassroomProgress {
  version: 1;
  lessons: Record<string, LessonProgress>;
  updatedAt: string;
}

function emptyLessonProgress(): LessonProgress {
  return {
    seen: [],
    totalSlides: 0,
    completed: false,
    completedAt: null,
    quizAnswered: 0,
    quizCorrect: 0,
  };
}

export function loadClassroomProgress(): ClassroomProgress {
  const fallback: ClassroomProgress = { version: 1, lessons: {}, updatedAt: new Date(0).toISOString() };
  try {
    const raw = localStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ClassroomProgress;
    if (parsed.version !== 1 || typeof parsed.lessons !== 'object') return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveClassroomProgress(p: ClassroomProgress): void {
  try {
    p.updatedAt = new Date().toISOString();
    localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — progress is a convenience, never a gate */
  }
}

export function getLessonProgress(progress: ClassroomProgress, lessonId: string): LessonProgress {
  return progress.lessons[lessonId] ?? emptyLessonProgress();
}

export function recordSlideSeen(lessonId: string, slideIndex: number, totalSlides: number): LessonProgress {
  const p = loadClassroomProgress();
  const lp = getLessonProgress(p, lessonId);
  if (!lp.seen.includes(slideIndex)) lp.seen.push(slideIndex);
  lp.totalSlides = totalSlides;
  p.lessons[lessonId] = lp;
  saveClassroomProgress(p);
  return lp;
}

export function recordQuizResult(lessonId: string, answered: number, correct: number): LessonProgress {
  const p = loadClassroomProgress();
  const lp = getLessonProgress(p, lessonId);
  lp.quizAnswered = Math.max(lp.quizAnswered, answered);
  lp.quizCorrect = Math.max(lp.quizCorrect, correct);
  p.lessons[lessonId] = lp;
  saveClassroomProgress(p);
  return lp;
}

export function completeLesson(lessonId: string): LessonProgress {
  const p = loadClassroomProgress();
  const lp = getLessonProgress(p, lessonId);
  if (!lp.completed) {
    lp.completed = true;
    lp.completedAt = new Date().toISOString();
  }
  p.lessons[lessonId] = lp;
  saveClassroomProgress(p);
  return lp;
}

export function resetClassroomProgress(): void {
  try {
    localStorage.removeItem(CLASSROOM_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Summary shape for Phase 1's Clubhouse Passport to consume. */
export function getClassroomSummary(): {
  key: string;
  completedLessons: string[];
  inProgressLessons: string[];
  perLesson: Record<string, LessonProgress>;
} {
  const p = loadClassroomProgress();
  const completedLessons: string[] = [];
  const inProgressLessons: string[] = [];
  for (const [id, lp] of Object.entries(p.lessons)) {
    if (lp.completed) completedLessons.push(id);
    else if (lp.seen.length > 0) inProgressLessons.push(id);
  }
  return { key: CLASSROOM_STORAGE_KEY, completedLessons, inProgressLessons, perLesson: p.lessons };
}
