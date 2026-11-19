import { useEffect, useRef, useState } from 'react';
import {
  BURN_IN_PRESETS,
  captionDownloadName,
  clearStudioDraft,
  cuesToSrt,
  cuesToVtt,
  enableCrossOriginIsolation,
  exportBurnedWebM,
  exportTrimmedMp4,
  exportTrimmedWebM,
  extractPcmSlice,
  formatCaptionTime,
  getBurnInPreset,
  isolationAlreadyAttempted,
  loadStudioDraft,
  loadWhisper,
  parseCaptionText,
  saveStudioDraft,
  transcribePcm,
  type BurnInPresetId,
  type CaptionCue,
  type StudioDraft,
  type WhisperPhase,
} from '../../lib/foundry';

type MediaKind = 'video' | 'audio';
type CapSize = 'standard' | 'large';
type CapPos = 'bottom' | 'top';

const MAX_TRANSCRIBE_SECONDS = 180;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function ReelFoundry() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>('video');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [now, setNow] = useState(0);

  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [capSize, setCapSize] = useState<CapSize>('standard');
  const [capPos, setCapPos] = useState<CapPos>('bottom');
  const [capBg, setCapBg] = useState(true);
  // Like the other studio style choices above, the look is kept for this
  // session only — the studio persists no preferences between visits.
  const [capPreset, setCapPreset] = useState<BurnInPresetId>('classic');

  const [whisperPhase, setWhisperPhase] = useState<WhisperPhase>('idle');
  const [whisperPct, setWhisperPct] = useState(0);
  const [whisperMsg, setWhisperMsg] = useState('');
  const [isolated] = useState<boolean>(
    () => typeof window !== 'undefined' && window.crossOriginIsolated === true,
  );
  const [isolationFailed] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      !window.crossOriginIsolated &&
      isolationAlreadyAttempted(),
  );

  const [recording, setRecording] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [webmPct, setWebmPct] = useState<number | null>(null);
  const [burnPct, setBurnPct] = useState<number | null>(null);
  const [status, setStatus] = useState('');

  const [manualStart, setManualStart] = useState('0');
  const [manualEnd, setManualEnd] = useState('2');
  const [manualText, setManualText] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<any>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const mrChunksRef = useRef<Blob[]>([]);

  // ------------------------------------------------------------- drafts
  // A saved work-in-progress edit (decisions only — never media bytes),
  // found in this browser on arrival and offered back, never applied
  // silently. See the STUDIO DRAFT CONTRACT in lib/foundry.
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftActiveRef = useRef(false);
  const draftClipRef = useRef<StudioDraft['clip']>(null);
  const lastSavedDraftRef = useRef<string | null>(null);
  const draftTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const d = loadStudioDraft();
    if (d) setPendingDraft(d);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mediaUrl]);

  // Autosave the edit decisions (never the media) whenever they change —
  // debounced, and only when they actually differ from the last write.
  // A page that was merely opened writes nothing: a stored draft that is
  // still awaiting the visitor's decision is left exactly as it was.
  useEffect(() => {
    const hasEdits =
      cues.length > 0 ||
      trimStart > 0.001 ||
      (duration > 0 && trimEnd > 0 && trimEnd < duration - 0.001) ||
      capSize !== 'standard' ||
      capPos !== 'bottom' ||
      capBg !== true ||
      capPreset !== 'classic';
    if (!hasEdits) {
      // Nothing worth keeping. If this session had a draft in play (a
      // clip loaded, or a draft restored) and the edit was emptied out,
      // the stored draft goes too — but a fresh page load must never
      // clear a draft the visitor hasn't decided about yet.
      if (file || draftActiveRef.current) {
        if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
        draftTimerRef.current = window.setTimeout(() => {
          clearStudioDraft();
          lastSavedDraftRef.current = null;
          setDraftSavedAt(null);
        }, 600);
      }
      return;
    }
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      const clip = file
        ? { name: file.name, type: file.type, size: file.size, kind: mediaKind, duration }
        : draftClipRef.current;
      const decisions = {
        clip,
        trimStart,
        trimEnd,
        cues,
        style: { size: capSize, position: capPos, background: capBg, preset: capPreset },
      };
      const serialized = JSON.stringify(decisions);
      if (serialized === lastSavedDraftRef.current) return;
      saveStudioDraft(decisions);
      lastSavedDraftRef.current = serialized;
      setDraftSavedAt(new Date().toISOString());
    }, 600);
  }, [file, mediaKind, duration, trimStart, trimEnd, cues, capSize, capPos, capBg, capPreset]);

  // The name caption downloads are filed under: the loaded clip's name,
  // or — after a draft restore, before the clip is re-selected — the
  // restored draft's clip name. Null → the studio default filename.
  const captionClipName = file?.name ?? draftClipRef.current?.name ?? null;

  const trimLen = Math.max(0, trimEnd - trimStart);
  const relNow = now - trimStart;
  const activeCue =
    relNow >= 0 && relNow <= trimLen
      ? cues.find((c) => relNow >= c.start && relNow < c.end)
      : undefined;

  function restoreDraft() {
    const d = pendingDraft;
    if (!d) return;
    setCues(d.cues);
    setCapSize(d.style.size);
    setCapPos(d.style.position);
    setCapBg(d.style.background);
    setCapPreset(d.style.preset);
    setTrimStart(d.trimStart);
    setTrimEnd(d.trimEnd);
    if (d.clip) setDuration(d.clip.duration);
    draftClipRef.current = d.clip;
    draftActiveRef.current = true;
    setDraftSavedAt(d.savedAt);
    setPendingDraft(null);
    setStatus(
      d.clip
        ? `Your saved edit is restored — the trim, ${d.cues.length} caption${d.cues.length === 1 ? '' : 's'} and your caption style are in place. The clip itself was never stored (nothing leaves this device), so re-select "${d.clip.name}" and the edit lands on it.`
        : 'Your saved edit is restored — captions and caption style are in place. Load the clip you were editing and the trim lands on it.',
    );
  }

  function discardDraft() {
    clearStudioDraft();
    lastSavedDraftRef.current = null;
    draftClipRef.current = null;
    setPendingDraft(null);
    setDraftSavedAt(null);
    setStatus(
      'Draft discarded. It only ever lived in this browser on this device, and now it is gone from here too.',
    );
  }

  function adoptFile(f: File) {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const kind: MediaKind = f.type.startsWith('audio/') ? 'audio' : 'video';
    setFile(f);
    setMediaKind(kind);
    setMediaUrl(URL.createObjectURL(f));
    setNow(0);
    setExportMsg('');
    if (draftActiveRef.current) {
      // A restored draft is waiting: keep its decisions (cues, trim,
      // style) and land them on this clip instead of wiping them.
      const dc = draftClipRef.current;
      const matches = !!dc && dc.name === f.name && dc.size === f.size;
      setStatus(
        matches
          ? `Loaded ${f.name} — the clip from your saved draft, with your restored trim and captions on it.`
          : `Loaded ${f.name} — your restored trim and captions are applied to it. Heads-up: the draft was made on ${dc ? `"${dc.name}"` : 'a clip you have not re-selected'}, so check the timings line up.`,
      );
      return;
    }
    setCues([]);
    setTrimStart(0);
    setTrimEnd(0);
    setDuration(0);
    setStatus(`Loaded ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB) — entirely on this device.`);
  }

  function onLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    setDuration(d);
    if (draftActiveRef.current) {
      // Keep the restored trim, clamped into the real duration.
      const end = Math.min(trimEnd > 0 ? trimEnd : d, d);
      const start = Math.min(trimStart, Math.max(0, end - 0.2));
      setTrimEnd(end);
      setTrimStart(start);
      return;
    }
    setTrimStart(0);
    setTrimEnd(d);
  }

  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    setNow(el.currentTime);
    if (!el.paused && trimEnd > 0 && el.currentTime >= trimEnd) el.pause();
  }

  function playTrimmed() {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = trimStart;
    void el.play();
  }

  // ------------------------------------------------------------- recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveRef.current) liveRef.current.srcObject = stream;
      try {
        const mod: any = await import('recordrtc');
        const RecordRTC = mod.default ?? mod;
        const rec = new RecordRTC(stream, { type: 'video', mimeType: 'video/webm' });
        rec.startRecording();
        recorderRef.current = rec;
      } catch {
        const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mrChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size) mrChunksRef.current.push(e.data);
        };
        mr.start(250);
        mrRef.current = mr;
      }
      setRecording(true);
      setStatus('Recording from your camera — the video stays in this browser tab.');
    } catch (e) {
      setStatus(`Camera unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function stopRecording() {
    const finish = (blob: Blob) => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      adoptFile(new File([blob], 'camera-recording.webm', { type: 'video/webm' }));
    };
    if (recorderRef.current) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      rec.stopRecording(() => finish(rec.getBlob()));
    } else if (mrRef.current) {
      const mr = mrRef.current;
      mrRef.current = null;
      mr.onstop = () => finish(new Blob(mrChunksRef.current, { type: 'video/webm' }));
      mr.stop();
    }
  }

  // ------------------------------------------------------------ whisper
  async function runTranscribe() {
    if (!file) return;
    if (trimLen > MAX_TRANSCRIBE_SECONDS) {
      setWhisperMsg(
        `Trial transcription covers up to ${MAX_TRANSCRIBE_SECONDS / 60} minutes per run — trim the clip to a shorter range first.`,
      );
      return;
    }
    setWhisperMsg('');
    try {
      await loadWhisper((phase, pct) => {
        setWhisperPhase(phase);
        if (pct !== undefined) setWhisperPct(pct);
      });
      setWhisperPhase('transcribing');
      const pcm = await extractPcmSlice(file, trimStart, trimEnd);
      // Let the "transcribing" state paint before the blocking WASM call.
      await new Promise((r) => setTimeout(r, 60));
      const result = await transcribePcm(pcm);
      setCues(result);
      setWhisperPhase('ready');
      setStatus(
        result.length
          ? `Transcribed on this device: ${result.length} caption cues. Nothing was uploaded.`
          : 'Transcription finished but heard no speech it could recognise. Try a clearer clip, or add captions manually below.',
      );
    } catch (e: any) {
      if (e?.code === 'needs-isolation') {
        setWhisperPhase('needs-isolation');
      } else {
        setWhisperPhase('error');
        setWhisperMsg(
          `Transcription failed on this device: ${e instanceof Error ? e.message : String(e)}. You can still import a caption file or type captions manually — nothing is blocked.`,
        );
      }
    }
  }

  function onEnableIsolation() {
    try {
      enableCrossOriginIsolation();
      setStatus('Reloading this page once with the transcription setup enabled…');
    } catch {
      setWhisperMsg(
        'The one-time setup reload already happened and this browser still does not allow the transcription engine (it needs SharedArrayBuffer). Caption import and manual captions below still work.',
      );
    }
  }

  // ------------------------------------------------------------ captions io
  async function onImportCaptions(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const kind = f.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt';
    const text = await f.text();
    const parsed = await parseCaptionText(text, kind);
    if (parsed.length) {
      setCues(parsed);
      setStatus(`Imported ${parsed.length} caption cues from ${f.name}.`);
    } else {
      setStatus(`No caption cues could be read from ${f.name}.`);
    }
  }

  function updateCue(i: number, patch: Partial<CaptionCue>) {
    setCues((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addManualCue() {
    const start = parseFloat(manualStart);
    const end = parseFloat(manualEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !manualText.trim()) {
      setStatus('A caption needs a start time, a later end time, and text.');
      return;
    }
    setCues((prev) =>
      [...prev, { start, end, text: manualText.trim() }].sort((a, b) => a.start - b.start),
    );
    setManualStart(String(end));
    setManualEnd(String(end + 2));
    setManualText('');
  }

  // ------------------------------------------------------------ export
  async function onExportMp4() {
    if (!file) return;
    setExportBusy(true);
    setExportMsg('Building the trimmed MP4 on this device (WebAV / WebCodecs)…');
    try {
      const res = await exportTrimmedMp4(file, trimStart, trimEnd);
      downloadBlob(res.blob, res.filename);
      setExportMsg(`Trimmed clip downloaded — engine: ${res.engine}. Captions are NOT burned into the MP4; pair it with the .SRT/.VTT alongside it, or use the captioned WebM export for a file with the captions in the picture.`);
    } catch (e) {
      setExportMsg(
        `MP4 export is not available for this file/browser (${e instanceof Error ? e.message : String(e)}). Use the WebM fallback below — it records the trimmed range in real time.`,
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function onExportWebM() {
    const el = videoRef.current;
    if (!el || mediaKind !== 'video') return;
    setExportBusy(true);
    setWebmPct(0);
    setExportMsg('Recording the trimmed range in real time for the WebM export — keep this tab in front…');
    try {
      const res = await exportTrimmedWebM(el, trimStart, trimEnd, setWebmPct);
      downloadBlob(res.blob, res.filename);
      setExportMsg(`Trimmed clip downloaded — engine: ${res.engine}. This plain trim has no captions in the picture — pair it with the .SRT/.VTT file, or use the captioned WebM export.`);
    } catch (e) {
      setExportMsg(`WebM export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExportBusy(false);
      setWebmPct(null);
    }
  }

  async function onExportBurned() {
    const el = videoRef.current;
    if (!el || mediaKind !== 'video' || cues.length === 0) return;
    setExportBusy(true);
    setBurnPct(0);
    setExportMsg(
      'Recording the trimmed range in real time with your styled captions burned into the picture — keep this tab in front…',
    );
    try {
      const res = await exportBurnedWebM(
        el,
        trimStart,
        trimEnd,
        cues,
        { size: capSize, position: capPos, background: capBg, preset: capPreset },
        setBurnPct,
      );
      downloadBlob(res.blob, res.filename);
      setExportMsg(
        `Captioned clip downloaded — engine: ${res.engine}. The captions are part of the picture now, in the ${getBurnInPreset(capPreset).name} look you picked above.`,
      );
    } catch (e) {
      setExportMsg(`Captioned export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExportBusy(false);
      setBurnPct(null);
    }
  }

  // The preview overlay is styled from the same preset definitions the
  // burn-in draws with (lib/foundry BURN_IN_PRESETS) — what you see here
  // is what the captioned WebM export burns.
  const capPresetDef = getBurnInPreset(capPreset);
  const capFontSize = `${((capSize === 'large' ? 1.35 : 1) * capPresetDef.fontScale).toFixed(3)}rem`;
  const capPreviewStyle: React.CSSProperties = {
    fontSize: capFontSize,
    fontWeight: capPresetDef.fontWeight,
    backgroundColor:
      capBg && capPresetDef.backingStyle === 'block' ? capPresetDef.backingColor : 'transparent',
    textShadow:
      capBg && capPresetDef.backingStyle === 'outline'
        ? '0 0 3px rgba(0, 0, 0, 0.9), 0 0 7px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.9)'
        : 'none',
  };

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="min-h-6 text-sm text-green-200/90">
        {status}
      </p>

      {/* ------------------------------------------ Saved draft offer */}
      {pendingDraft && (
        <section className="rounded-lg border border-yellow-500/50 bg-yellow-900/20 p-5">
          <h2 className="mb-2 text-xl font-bold text-yellow-200">Pick up an unfinished edit?</h2>
          <p className="text-sm leading-relaxed text-yellow-100/90">
            This browser holds a draft of an edit you left unfinished
            {pendingDraft.savedAt
              ? ` — saved ${new Date(pendingDraft.savedAt).toLocaleString()}`
              : ''}
            , on <strong className="text-yellow-100">this device only</strong>. It holds the edit
            decisions — a trim of {pendingDraft.trimStart.toFixed(1)}s →{' '}
            {pendingDraft.trimEnd.toFixed(1)}s, {pendingDraft.cues.length} caption
            {pendingDraft.cues.length === 1 ? '' : 's'} and your caption style
            {pendingDraft.clip ? (
              <>
                {' '}
                for <strong className="text-yellow-100">{pendingDraft.clip.name}</strong>
              </>
            ) : (
              ''
            )}
            . Nothing was ever uploaded, and the clip file itself is{' '}
            <strong className="text-yellow-100">not</strong> stored — restoring brings back the
            trim, captions and style, and you re-select the clip to land them on.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
            >
              Restore my edit
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded border border-gray-500 px-4 py-2 font-semibold text-gray-200 hover:border-red-400 hover:text-red-300"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={() => setPendingDraft(null)}
              className="rounded px-3 py-2 text-sm text-gray-400 underline hover:text-gray-200"
            >
              Not now — keep it saved for next time
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Step 1: source */}
      <section className="rounded-lg border border-green-500/30 bg-gray-800 p-5">
        <h2 className="mb-3 text-2xl font-bold text-green-400">1 · Load or record a clip</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500">
            Choose a video or audio file
            <input
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) adoptFile(f);
              }}
            />
          </label>
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="rounded border border-green-500/50 px-4 py-2 font-semibold text-green-200 hover:border-green-400"
            >
              ● Record with your camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="rounded bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500"
            >
              ■ Stop recording &amp; use it
            </button>
          )}
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setMediaUrl(null);
                setCues([]);
                draftActiveRef.current = false;
                draftClipRef.current = null;
                lastSavedDraftRef.current = null;
                clearStudioDraft();
                setDraftSavedAt(null);
                setStatus('Cleared. Nothing was uploaded, so there is nothing to delete anywhere.');
              }}
              className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:border-red-400 hover:text-red-300"
            >
              Start over
            </button>
          )}
        </div>
        {recording && (
          <video ref={liveRef} autoPlay muted playsInline className="mt-4 w-full max-w-xl rounded" />
        )}
        <p className="mt-3 text-sm text-gray-400">
          Trial scope: short clips work best — transcription covers up to 3 minutes per run. Your
          file is read by your browser only; it is never uploaded.
        </p>
        {draftSavedAt && !pendingDraft && (
          <p className="mt-2 text-xs text-gray-500">
            A draft of this edit is saved on this device (
            {new Date(draftSavedAt).toLocaleTimeString()}) — trim, captions and style only, never
            the clip itself.{' '}
            <button
              type="button"
              onClick={discardDraft}
              className="underline hover:text-red-300"
            >
              Discard draft
            </button>
          </p>
        )}

        {mediaUrl && (
          <div className="mt-5">
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg bg-black">
              {mediaKind === 'video' ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  controls
                  playsInline
                  className="w-full"
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                />
              ) : (
                <div className="p-6">
                  <p className="mb-3 text-green-200">Audio clip loaded — captions preview as text below.</p>
                  <audio
                    ref={videoRef as any}
                    src={mediaUrl}
                    controls
                    className="w-full"
                    onLoadedMetadata={onLoadedMetadata}
                    onTimeUpdate={onTimeUpdate}
                  />
                </div>
              )}
              {mediaKind === 'video' && (
                <div
                  className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${
                    capPos === 'bottom' ? 'bottom-10' : 'top-4'
                  }`}
                >
                  {activeCue && (
                    <span
                      style={capPreviewStyle}
                      className="rounded px-3 py-1 text-center leading-snug text-white"
                    >
                      {activeCue.text}
                    </span>
                  )}
                </div>
              )}
            </div>
            {mediaKind === 'audio' && activeCue && (
              <p className="mx-auto mt-3 max-w-3xl rounded bg-black/60 px-3 py-2 text-center font-semibold text-white">
                {activeCue.text}
              </p>
            )}

            {/* Trim controls */}
            <div className="mx-auto mt-4 max-w-3xl rounded border border-gray-700 bg-gray-900/60 p-4">
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-gray-300">
                <span>
                  Trim: <strong className="text-gray-100">{formatCaptionTime(trimStart, '.')}</strong> →{' '}
                  <strong className="text-gray-100">{formatCaptionTime(trimEnd, '.')}</strong>
                </span>
                <span>
                  Length: <strong className="text-gray-100">{trimLen.toFixed(1)}s</strong> of{' '}
                  {duration.toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={playTrimmed}
                  className="rounded bg-green-700 px-3 py-1 font-semibold text-white hover:bg-green-600"
                >
                  ▶ Play trimmed range
                </button>
              </div>
              <label className="block text-xs text-gray-400">
                Start
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 0.2))}
                  className="w-full accent-green-500"
                />
              </label>
              <label className="block text-xs text-gray-400">
                End
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 0.2))}
                  className="w-full accent-green-500"
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Caption times are relative to the trimmed clip (0 = your trim start).
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ Step 2: captions */}
      <section className="rounded-lg border border-green-500/30 bg-gray-800 p-5">
        <h2 className="mb-3 text-2xl font-bold text-green-400">2 · Captions</h2>
        <p className="mb-4 text-gray-300">
          Three ways to get captions — all on this device. Auto-transcription runs the whisper.cpp
          engine (OpenAI's Whisper model, compiled to WebAssembly) <em>inside your browser</em>:{' '}
          <strong className="text-gray-100">your audio never leaves this tab</strong> — there is no
          server for it to go to.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded border border-gray-700 bg-gray-900/60 p-4">
            <h3 className="mb-2 font-bold text-gray-100">A · Auto-transcribe</h3>
            {whisperPhase === 'needs-isolation' || (!isolated && whisperPhase !== 'ready') ? (
              <>
                <p className="mb-3 text-sm text-gray-300">
                  The transcription engine is multi-threaded and needs a one-time browser setup:
                  this page reloads once with extra isolation headers (scoped to this studio page
                  only). Your loaded clip will need re-selecting after the reload — it never left
                  your device, so there is no copy to restore from.
                </p>
                {isolationFailed ? (
                  <p className="text-sm text-yellow-200">
                    The setup reload already ran and this browser still blocks the engine
                    (SharedArrayBuffer unavailable). Options B and C below work regardless.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onEnableIsolation}
                    className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
                  >
                    Enable transcription (reloads once)
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!file || whisperPhase === 'runtime' || whisperPhase === 'model' || whisperPhase === 'transcribing'}
                  onClick={runTranscribe}
                  className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500 disabled:opacity-40"
                >
                  {whisperPhase === 'transcribing'
                    ? 'Transcribing…'
                    : whisperPhase === 'model'
                      ? `Downloading model… ${whisperPct}%`
                      : whisperPhase === 'runtime'
                        ? 'Loading engine…'
                        : 'Transcribe trimmed range'}
                </button>
                <p className="mt-2 text-sm text-gray-400">
                  {whisperPhase === 'model' &&
                    'One-time ~31 MB model download (the tiny.en speech model), cached in your browser for next time.'}
                  {whisperPhase === 'transcribing' &&
                    'Listening on-device… this can take a little while for longer clips. The tab may pause while it works.'}
                  {whisperPhase === 'ready' && 'Engine ready — runs entirely in this tab.'}
                  {(whisperPhase === 'idle' || whisperPhase === 'error') &&
                    (file
                      ? 'Uses the trimmed range. English speech, tiny model — good for clear speech, not a studio transcript.'
                      : 'Load a clip first.')}
                </p>
              </>
            )}
            {whisperMsg && <p className="mt-2 text-sm text-yellow-200">{whisperMsg}</p>}
          </div>

          <div className="rounded border border-gray-700 bg-gray-900/60 p-4">
            <h3 className="mb-2 font-bold text-gray-100">B · Import a caption file</h3>
            <p className="mb-3 text-sm text-gray-300">
              Already have captions? Bring an .srt or .vtt file — parsed here, on-device.
            </p>
            <label className="inline-block cursor-pointer rounded border border-green-500/50 px-4 py-2 font-semibold text-green-200 hover:border-green-400">
              Choose .srt / .vtt
              <input type="file" accept=".srt,.vtt" className="hidden" onChange={onImportCaptions} />
            </label>
          </div>

          <div className="rounded border border-gray-700 bg-gray-900/60 p-4">
            <h3 className="mb-2 font-bold text-gray-100">C · Type captions</h3>
            <div className="flex gap-2">
              <label className="text-xs text-gray-400">
                Start (s)
                <input
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-gray-100"
                />
              </label>
              <label className="text-xs text-gray-400">
                End (s)
                <input
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-gray-100"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-gray-400">
              Text
              <input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-gray-100"
                placeholder="What is said in this range…"
              />
            </label>
            <button
              type="button"
              onClick={addManualCue}
              className="mt-3 rounded border border-green-500/50 px-4 py-2 font-semibold text-green-200 hover:border-green-400"
            >
              Add caption
            </button>
          </div>
        </div>

        {/* Style controls */}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <span className="font-semibold text-gray-100">Preview style:</span>
          <label>
            Look{' '}
            <select
              value={capPreset}
              onChange={(e) => setCapPreset(e.target.value as BurnInPresetId)}
              className="rounded bg-gray-900 px-2 py-1 text-gray-100"
            >
              {BURN_IN_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-gray-500">{capPresetDef.blurb}</span>
          <label>
            Size{' '}
            <select
              value={capSize}
              onChange={(e) => setCapSize(e.target.value as CapSize)}
              className="rounded bg-gray-900 px-2 py-1 text-gray-100"
            >
              <option value="standard">Standard</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Position{' '}
            <select
              value={capPos}
              onChange={(e) => setCapPos(e.target.value as CapPos)}
              className="rounded bg-gray-900 px-2 py-1 text-gray-100"
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capBg}
              onChange={(e) => setCapBg(e.target.checked)}
              className="accent-green-500"
            />
            Dark backing behind text
          </label>
          <span className="text-gray-500">Style applies to the preview and to the captioned WebM export. Each look has its own backing — a dark block for Classic and Bold, a dark outline for Minimal — and the backing toggle turns it on or off. The .SRT/.VTT files keep plain text + timing.</span>
        </div>

        {/* Cue editor */}
        {cues.length > 0 ? (
          <div className="mt-5">
            <h3 className="mb-2 font-bold text-gray-100">
              Captions ({cues.length}) — edit text or timing, times in seconds from the trim start
            </h3>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {cues.map((cue, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded bg-gray-900/60 p-2">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={cue.start}
                    onChange={(e) => updateCue(i, { start: parseFloat(e.target.value) || 0 })}
                    className="w-20 rounded bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    aria-label={`Caption ${i + 1} start seconds`}
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={cue.end}
                    onChange={(e) => updateCue(i, { end: parseFloat(e.target.value) || 0 })}
                    className="w-20 rounded bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    aria-label={`Caption ${i + 1} end seconds`}
                  />
                  <input
                    value={cue.text}
                    onChange={(e) => updateCue(i, { text: e.target.value })}
                    className="min-w-48 flex-1 rounded bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    aria-label={`Caption ${i + 1} text`}
                  />
                  <button
                    type="button"
                    onClick={() => setCues((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:border-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded bg-black/40 p-3 text-sm leading-relaxed text-gray-200">
              <strong className="text-gray-100">Transcript:</strong>{' '}
              {cues.map((c) => c.text).join(' ')}
            </p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-gray-400">
            No captions yet. Transcribe, import, or type them — the preview above shows them over
            your clip as it plays.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ Step 3: export */}
      <section className="rounded-lg border border-green-500/30 bg-gray-800 p-5">
        <h2 className="mb-3 text-2xl font-bold text-green-400">3 · Export</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={cues.length === 0}
            onClick={() => downloadBlob(new Blob([cuesToSrt(cues)], { type: 'text/plain' }), captionDownloadName(captionClipName, 'srt'))}
            className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500 disabled:opacity-40"
          >
            Download captions (.SRT)
          </button>
          <button
            type="button"
            disabled={cues.length === 0}
            onClick={() => downloadBlob(new Blob([cuesToVtt(cues)], { type: 'text/vtt' }), captionDownloadName(captionClipName, 'vtt'))}
            className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500 disabled:opacity-40"
          >
            Download captions (.VTT)
          </button>
          {mediaKind === 'video' && (
            <>
              <button
                type="button"
                disabled={!file || cues.length === 0 || exportBusy}
                onClick={onExportBurned}
                className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500 disabled:opacity-40"
              >
                Download captioned clip (.WebM, captions burned in{burnPct !== null ? ` — ${burnPct}%` : ''})
              </button>
              <button
                type="button"
                disabled={!file || exportBusy}
                onClick={onExportMp4}
                className="rounded border border-green-500/60 px-4 py-2 font-semibold text-green-100 hover:border-green-400 disabled:opacity-40"
              >
                Download trimmed clip (.MP4)
              </button>
              <button
                type="button"
                disabled={!file || exportBusy}
                onClick={onExportWebM}
                className="rounded border border-gray-500 px-4 py-2 font-semibold text-gray-200 hover:border-gray-300 disabled:opacity-40"
              >
                Trimmed clip (.WebM fallback{webmPct !== null ? ` — ${webmPct}%` : ''})
              </button>
            </>
          )}
        </div>
        {cues.length === 0 && (
          <p className="mt-3 text-sm text-gray-400">
            The caption files (.SRT/.VTT) are ready once you have captions — transcribe, import, or
            type them in Step 2 above. They carry the caption text and timing on their own (nothing
            is baked into the picture), and they download under your clip's name.
          </p>
        )}
        {mediaKind === 'audio' && file && (
          <p className="mt-3 text-sm text-gray-400">
            Trimmed-clip export works with video files. For this audio clip, the caption files above
            are the export.
          </p>
        )}
        {exportMsg && <p className="mt-3 text-sm text-green-200/90">{exportMsg}</p>}
        <div className="mt-4 rounded border border-yellow-500/40 bg-yellow-900/20 p-3 text-sm text-yellow-100">
          <strong>Honest scope:</strong> burning your styled captions into the picture works
          today in the captioned WebM export — it re-records the trimmed range in real time,
          so it takes as long as the clip plays, and the file it makes is a WebM. The MP4
          export has no captions in the picture; it pairs with the separate .SRT/.VTT caption
          file instead, which players and platforms accept alongside the video. Nothing here
          is labelled as doing more than it does.
        </div>
      </section>
    </div>
  );
}
