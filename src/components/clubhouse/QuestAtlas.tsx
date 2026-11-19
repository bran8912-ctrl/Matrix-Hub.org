import { useEffect, useRef, useState } from "react";
import {
  BUILDINGS,
  COLS,
  FOUNTAINS,
  FLOWERS,
  ROWS,
  SPAWN_TILE,
  TILE,
  TREES,
  WORLD_H,
  WORLD_W,
  buildingAt,
  doorNear,
  doorPoint,
  groundAt,
  isSolidTile,
  tileCenter,
  type Building,
} from "../../lib/atlas";

// Quest Atlas island. The engine is hand-rolled on purpose (see
// src/lib/atlas.ts): tile rendering, AABB collision, a follow camera and
// door-zone triggers are all this map needs, and they ship in this small
// chunk instead of a ~1 MB engine bundle. All art is drawn in code.
//
// Standing enhancement 1 (Clubhouse enhancement board): a persisted Snow
// toggle (winter skin + in-code falling snow) and a live minimap — both
// rendered from the same atlas.ts data, no new dependencies, no assets.
//
// Standing enhancement 2: door previews. Hovering the map (pointer),
// tabbing to a building's door marker (keyboard), or long-pressing a
// building (touch) shows that building's name + blurb from atlas.ts —
// the same line its door card uses — without walking to it. Walking up
// to a door still opens the door card exactly as before. Touch uses
// long-press rather than first-tap on purpose: a quick tap keeps its
// existing meaning (walk there), so the two never fight.

const SPEED = 152; // px per second
const HALF = 11; // player half-extent (AABB)
const COIN_TILE = { x: 23, y: 14 }; // gold MTX medallion in the plaza

const SNOW_KEY = "mh_atlas_snow";
// Minimap geometry: logical px per tile and the avatar-dot scale from
// world px. 46x34 tiles -> a 184x136 canvas in the map's corner.
const MM_TILE = 4;
const MM_W = COLS * MM_TILE;
const MM_H = ROWS * MM_TILE;
const MM_SCALE = MM_TILE / TILE;

// Door-preview focus order: reading order over the town (top row first,
// left to right within a row), independent of the BUILDINGS table order.
const FOCUS_ORDER: Building[] = [...BUILDINGS].sort(
  (a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x,
);
const ZONE = 44; // door-marker size px (touch-target friendly)
const LONG_PRESS_MS = 450;

interface Pad {
  x: number;
  y: number;
}

interface Flake {
  fx: number; // 0..1 across the viewport
  fy: number; // 0..1 down the viewport
  r: number; // radius px
  sp: number; // fall speed px/s
  ph: number; // drift phase
}

export default function QuestAtlas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef(tileCenter(SPAWN_TILE.x, SPAWN_TILE.y));
  const keysRef = useRef<Set<string>>(new Set());
  const padRef = useRef<Pad>({ x: 0, y: 0 });
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const engagedRef = useRef(false);
  const framesRef = useRef(0);
  const doorIdRef = useRef<string | null>(null);
  const viewRef = useRef({ w: 960, h: 576 });
  const snowRef = useRef(false);
  const miniOpenRef = useRef(true);

  // --- door previews (enhancement 2) -------------------------------------
  // Three sources, one effective preview: keyboard focus wins over a
  // long-press, which wins over pointer hover. Esc dismisses the current
  // preview and suppresses it until the source target changes.
  const hoverIdRef = useRef<string | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const pressIdRef = useRef<string | null>(null);
  const dismissedIdRef = useRef<string | null>(null);
  const previewIdRef = useRef<string | null>(null);
  const zoneRefs = useRef(new Map<string, HTMLButtonElement>());
  const pressInfoRef = useRef<{
    pointerId: number;
    target: { x: number; y: number };
    pressId: string | null;
    fired: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const [preview, setPreview] = useState<Building | null>(null);
  const [door, setDoor] = useState<Building | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [snow, setSnow] = useState(false);
  // The minimap starts open on wide screens, collapsed on phones.
  const [miniOpen, setMiniOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );

  // Recompute the effective preview from the three sources.
  const syncPreview = () => {
    const candidate = focusIdRef.current ?? pressIdRef.current ?? hoverIdRef.current;
    const id = candidate && candidate !== dismissedIdRef.current ? candidate : null;
    previewIdRef.current = id;
    setPreview(id ? (BUILDINGS.find((b) => b.id === id) ?? null) : null);
  };
  const noteSource = (id: string | null) => {
    // A source moving to a different building (or away) re-arms previews
    // after an Esc dismissal.
    if (id !== dismissedIdRef.current) dismissedIdRef.current = null;
  };
  const applyHover = (id: string | null) => {
    noteSource(id);
    hoverIdRef.current = id;
    syncPreview();
  };
  const applyFocus = (id: string | null) => {
    noteSource(id);
    focusIdRef.current = id;
    syncPreview();
  };
  const applyPress = (id: string | null) => {
    noteSource(id);
    pressIdRef.current = id;
    syncPreview();
  };

  // Esc dismisses the current preview, whichever source raised it.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !previewIdRef.current) return;
      dismissedIdRef.current = previewIdRef.current;
      pressIdRef.current = null;
      previewIdRef.current = null;
      setPreview(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // --- enhancement state: persisted Snow toggle -------------------------
    let initialSnow = false;
    try {
      initialSnow = localStorage.getItem(SNOW_KEY) === "1";
    } catch {
      initialSnow = false;
    }
    snowRef.current = initialSnow;
    setSnow(initialSnow);
    miniOpenRef.current = window.innerWidth >= 768;
    setMiniOpen(miniOpenRef.current);

    // Falling snow: ~90 in-code flakes, positions normalised to the
    // viewport so a resize never needs a rebuild. They only advance while
    // snow is on, motion is allowed, and the tab is visible (rAF already
    // stops in a hidden tab; the explicit check covers occluded windows).
    const flakes: Flake[] = Array.from({ length: 90 }, () => ({
      fx: Math.random(),
      fy: Math.random(),
      r: 0.9 + Math.random() * 1.8,
      sp: 26 + Math.random() * 38,
      ph: Math.random() * Math.PI * 2,
    }));

    // --- minimap: static town layout pre-rendered once per skin ---------
    const buildBase = (snowMode: boolean) => {
      const SS = 2; // supersample so the downscale stays crisp
      const c = document.createElement("canvas");
      c.width = MM_W * SS;
      c.height = MM_H * SS;
      const g = c.getContext("2d");
      if (!g) return c;
      const s = MM_TILE * SS;
      for (let ty = 0; ty < ROWS; ty++) {
        for (let tx = 0; tx < COLS; tx++) {
          const border = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
          const kind = groundAt(tx, ty);
          if (border) g.fillStyle = snowMode ? "#c3d4de" : "#0b3d20";
          else if (kind === "plaza") g.fillStyle = snowMode ? "#6d6660" : "#44403c";
          else if (kind === "path") g.fillStyle = snowMode ? "#a39c94" : "#78716c";
          else
            g.fillStyle = snowMode
              ? (tx + ty) % 2
                ? "#e8eef2"
                : "#dbe5ec"
              : (tx + ty) % 2
                ? "#14532d"
                : "#124a28";
          g.fillRect(tx * s, ty * s, s, s);
          if (!border && TREES.has(`${tx},${ty}`)) {
            g.fillStyle = snowMode ? "#9db8a6" : "#166534";
            g.fillRect(tx * s + 1, ty * s + 1, s - 2, s - 2);
          }
        }
      }
      for (const f of FOUNTAINS) {
        g.fillStyle = "#2563eb";
        g.fillRect(f.x * s, f.y * s, f.w * s, f.h * s);
      }
      for (const b of BUILDINGS) {
        g.fillStyle = b.body;
        g.fillRect(b.rect.x * s, b.rect.y * s, b.rect.w * s, b.rect.h * s);
        g.fillStyle = b.roof;
        g.fillRect(b.rect.x * s, b.rect.y * s, b.rect.w * s, Math.max(2, Math.round(b.rect.h * s * 0.34)));
        if (snowMode) {
          g.fillStyle = "#f8fafc";
          g.fillRect(b.rect.x * s, b.rect.y * s, b.rect.w * s, 2);
        }
      }
      return c;
    };
    const miniBases = { classic: buildBase(false), snow: buildBase(true) };
    const mini = miniRef.current;
    const miniCtx = mini ? mini.getContext("2d") : null;
    if (mini) {
      mini.width = Math.round(MM_W * dpr);
      mini.height = Math.round(MM_H * dpr);
    }

    const resize = () => {
      const w = wrap.clientWidth;
      const h = Math.max(340, Math.min(600, Math.round(w * 0.6)));
      viewRef.current = { w, h };
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const collide = (x: number, y: number) => {
      const pts: Array<[number, number]> = [
        [x - HALF, y - HALF],
        [x + HALF, y - HALF],
        [x - HALF, y + HALF],
        [x + HALF, y + HALF],
      ];
      return pts.some(([px, py]) => isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE)));
    };

    let raf = 0;
    let last = performance.now();

    const drawBuilding = (b: Building, camX: number, camY: number, active: boolean, t: number, snowOn: boolean, previewed: boolean) => {
      const x = b.rect.x * TILE - camX;
      const y = b.rect.y * TILE - camY;
      const w = b.rect.w * TILE;
      const h = b.rect.h * TILE;
      // shadow + body
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 4, y + 6, w, h);
      ctx.fillStyle = b.body;
      ctx.fillRect(x, y, w, h);
      // roof band
      ctx.fillStyle = b.roof;
      ctx.fillRect(x, y, w, Math.round(h * 0.34));
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(x, y + Math.round(h * 0.34), w, 3);
      if (snowOn) {
        // snow-dusted roof: a settled cap on top, a dusting over the band
        ctx.fillStyle = "rgba(248,250,252,0.30)";
        ctx.fillRect(x, y, w, Math.round(h * 0.34));
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x, y, w, 5);
        ctx.fillRect(x, y + Math.round(h * 0.34) - 2, w, 2);
      }
      // door (on the footprint edge nearest the door tile)
      const dp = doorPoint(b);
      const dx = Math.max(x + 6, Math.min(x + w - 22, dp.x - camX - 8));
      const dy = Math.max(y + 6, Math.min(y + h - 26, dp.y - camY - 13));
      ctx.fillStyle = active ? "#fde68a" : "#1f2937";
      ctx.fillRect(dx, dy, 16, 24);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(dx + 12, dy + 11, 3, 3);
      // sign plaque with the building's name, shrunk to fit
      const plaqueW = w - 12;
      let size = 11;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      do {
        ctx.font = `700 ${size}px system-ui, sans-serif`;
        size -= 1;
      } while (ctx.measureText(b.sign).width > plaqueW - 8 && size > 6);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x + 6, y + 6, plaqueW, 16);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(b.sign, x + w / 2, y + 14.5);
      if (active) {
        const pulse = reduced ? 3 : 3 + Math.sin(t / 280) * 1.5;
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dp.x - camX, dp.y - camY, 13 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (previewed && !active) {
        // preview highlight: a sky outline on the building + a ring on
        // its door point, so hover/focus/long-press is visible in-world
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        ctx.beginPath();
        ctx.arc(dp.x - camX, dp.y - camY, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      framesRef.current += 1;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // --- input vector -------------------------------------------------
      let vx = padRef.current.x;
      let vy = padRef.current.y;
      const k = keysRef.current;
      if (k.has("arrowleft") || k.has("a")) vx -= 1;
      if (k.has("arrowright") || k.has("d")) vx += 1;
      if (k.has("arrowup") || k.has("w")) vy -= 1;
      if (k.has("arrowdown") || k.has("s")) vy += 1;
      if (vx !== 0 || vy !== 0) {
        targetRef.current = null;
      } else if (targetRef.current) {
        const dx = targetRef.current.x - posRef.current.x;
        const dy = targetRef.current.y - posRef.current.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) targetRef.current = null;
        else {
          vx = dx / d;
          vy = dy / d;
        }
      }
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy) || 1;
        const step = (SPEED * dt) / len;
        const nx = posRef.current.x + vx * step;
        if (!collide(nx, posRef.current.y)) posRef.current.x = nx;
        const ny = posRef.current.y + vy * step;
        if (!collide(posRef.current.x, ny)) posRef.current.y = ny;
        posRef.current.x = Math.max(HALF, Math.min(WORLD_W - HALF, posRef.current.x));
        posRef.current.y = Math.max(HALF, Math.min(WORLD_H - HALF, posRef.current.y));
      }

      // --- door trigger ---------------------------------------------------
      const near = doorNear(posRef.current.x, posRef.current.y);
      const nid = near?.id ?? null;
      if (nid !== doorIdRef.current) {
        doorIdRef.current = nid;
        setDoor(near ?? null);
      }

      // --- render ---------------------------------------------------------
      const snowOn = snowRef.current;
      const { w: vw, h: vh } = viewRef.current;
      const camX = Math.max(0, Math.min(WORLD_W - vw, posRef.current.x - vw / 2));
      const camY = Math.max(0, Math.min(WORLD_H - vh, posRef.current.y - vh / 2));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#052e16";
      ctx.fillRect(0, 0, vw, vh);

      const tx0 = Math.max(0, Math.floor(camX / TILE));
      const ty0 = Math.max(0, Math.floor(camY / TILE));
      const tx1 = Math.min(45, Math.ceil((camX + vw) / TILE));
      const ty1 = Math.min(33, Math.ceil((camY + vh) / TILE));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const sx = tx * TILE - camX;
          const sy = ty * TILE - camY;
          const g = groundAt(tx, ty);
          const border = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
          if (snowOn) {
            if (border) ctx.fillStyle = "#175731"; // hedge green under its dusting
            else if (g === "plaza") ctx.fillStyle = (tx + ty) % 2 ? "#44403c" : "#3f3a36";
            else if (g === "path") ctx.fillStyle = (tx + ty) % 2 ? "#8f8880" : "#847d76";
            else ctx.fillStyle = (tx + ty) % 2 ? "#e8eef2" : "#dbe5ec"; // snowfield
          } else if (g === "plaza") ctx.fillStyle = (tx + ty) % 2 ? "#44403c" : "#3f3a36";
          else if (g === "path") ctx.fillStyle = (tx + ty) % 2 ? "#78716c" : "#6d6660";
          else ctx.fillStyle = (tx + ty) % 2 ? "#14532d" : "#124a28";
          ctx.fillRect(sx, sy, TILE, TILE);
          if (snowOn && border) {
            // snow settled on the hedge: a cap along the top, a drift at the foot
            ctx.fillStyle = "rgba(248,250,252,0.85)";
            ctx.fillRect(sx, sy, TILE, 6);
            ctx.fillStyle = "rgba(248,250,252,0.35)";
            ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
          }
          if (snowOn && g === "plaza") {
            // white plaza edges where stone meets snow or street
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (groundAt(tx, ty - 1) !== "plaza") {
              ctx.moveTo(sx, sy + 1);
              ctx.lineTo(sx + TILE, sy + 1);
            }
            if (groundAt(tx, ty + 1) !== "plaza") {
              ctx.moveTo(sx, sy + TILE - 1);
              ctx.lineTo(sx + TILE, sy + TILE - 1);
            }
            if (groundAt(tx - 1, ty) !== "plaza") {
              ctx.moveTo(sx + 1, sy);
              ctx.lineTo(sx + 1, sy + TILE);
            }
            if (groundAt(tx + 1, ty) !== "plaza") {
              ctx.moveTo(sx + TILE - 1, sy);
              ctx.lineTo(sx + TILE - 1, sy + TILE);
            }
            ctx.stroke();
          }
          if (!snowOn && FLOWERS.has(`${tx},${ty}`)) {
            ctx.fillStyle = "#f472b6";
            ctx.beginPath();
            ctx.arc(sx + 9, sy + 11, 2.2, 0, Math.PI * 2);
            ctx.arc(sx + 22, sy + 21, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#facc15";
            ctx.beginPath();
            ctx.arc(sx + 16, sy + 16, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // plaza medallion — the gold MTX coin
      const coin = tileCenter(COIN_TILE.x, COIN_TILE.y);
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.arc(coin.x - camX, coin.y - camY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(coin.x - camX, coin.y - camY, 11.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#451a03";
      ctx.font = "800 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("MTX", coin.x - camX, coin.y - camY + 0.5);

      // fountains (twin basins flanking Main Street)
      for (const f of FOUNTAINS) {
        const fx = f.x * TILE - camX;
        const fy = f.y * TILE - camY;
        const fw = f.w * TILE;
        const fh = f.h * TILE;
        ctx.fillStyle = "#a8a29e";
        ctx.fillRect(fx - 2, fy - 2, fw + 4, fh + 4);
        ctx.fillStyle = "#2563eb";
        ctx.fillRect(fx, fy, fw, fh);
        ctx.strokeStyle = "rgba(191,219,254,0.85)";
        ctx.lineWidth = 1.6;
        const ph = reduced ? 0 : now / 700;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(fx + fw / 2, fy + fh / 2, 6 + i * 7 + Math.sin(ph + i) * 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // trees
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!TREES.has(`${tx},${ty}`)) continue;
          const cx = tx * TILE + 16 - camX;
          const cy = ty * TILE + 16 - camY;
          ctx.fillStyle = "#78350f";
          ctx.fillRect(cx - 2, cy + 4, 4, 8);
          ctx.fillStyle = "#166534";
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(cx - 4, cy - 6, 6, 0, Math.PI * 2);
          ctx.fill();
          if (snowOn) {
            ctx.fillStyle = "rgba(248,250,252,0.9)";
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 8, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 5, cy - 3, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // buildings
      for (const b of BUILDINGS)
        drawBuilding(b, camX, camY, b.id === doorIdRef.current, now, snowOn, b.id === previewIdRef.current);

      // --- door markers: project each keyboard-focusable zone over its
      // door point for this frame's camera ------------------------------
      for (const b of BUILDINGS) {
        const el = zoneRefs.current.get(b.id);
        if (!el) continue;
        const dp = doorPoint(b);
        const zx = dp.x - camX - ZONE / 2;
        const zy = dp.y - camY - ZONE / 2;
        el.style.transform = `translate(${zx}px, ${zy}px)`;
        el.style.visibility =
          zx > -ZONE && zy > -ZONE && zx < vw && zy < vh ? "visible" : "hidden";
      }

      // player — a small gold-cloaked figure
      const px = posRef.current.x - camX;
      const py = posRef.current.y - camY;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(px, py + 11, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d97706";
      ctx.beginPath();
      ctx.moveTo(px, py - 12);
      ctx.lineTo(px + 8, py + 10);
      ctx.lineTo(px - 8, py + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(px, py - 13, 5, 0, Math.PI * 2);
      ctx.fill();

      // --- minimap: pre-rendered town, live dots -------------------------
      if (miniCtx && miniOpenRef.current) {
        miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        miniCtx.clearRect(0, 0, MM_W, MM_H);
        miniCtx.drawImage(snowOn ? miniBases.snow : miniBases.classic, 0, 0, MM_W, MM_H);
        miniCtx.strokeStyle = "rgba(255,255,255,0.40)";
        miniCtx.lineWidth = 1;
        miniCtx.strokeRect(camX * MM_SCALE, camY * MM_SCALE, vw * MM_SCALE, vh * MM_SCALE);
        miniCtx.fillStyle = "#fbbf24";
        for (const b of BUILDINGS) {
          const dp = doorPoint(b);
          miniCtx.beginPath();
          miniCtx.arc(dp.x * MM_SCALE, dp.y * MM_SCALE, 2, 0, Math.PI * 2);
          miniCtx.fill();
          if (b.id === previewIdRef.current) {
            // the previewed building's door dot rings in sync
            miniCtx.strokeStyle = "#38bdf8";
            miniCtx.lineWidth = 1.4;
            miniCtx.beginPath();
            miniCtx.arc(dp.x * MM_SCALE, dp.y * MM_SCALE, 4.5, 0, Math.PI * 2);
            miniCtx.stroke();
          }
        }
        miniCtx.fillStyle = "#f59e0b";
        miniCtx.strokeStyle = "#ffffff";
        miniCtx.lineWidth = 1.4;
        miniCtx.beginPath();
        miniCtx.arc(posRef.current.x * MM_SCALE, posRef.current.y * MM_SCALE, 3, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.stroke();
      }

      // --- falling snow (topmost; frozen when hidden or reduced-motion) --
      if (snowOn && !reduced && !document.hidden) {
        ctx.fillStyle = "#ffffff";
        for (const f of flakes) {
          f.fy += (f.sp * dt) / Math.max(1, vh);
          if (f.fy > 1.03) {
            f.fy = -0.03;
            f.fx = Math.random();
          }
          const drift = Math.sin(now / 1300 + f.ph) * 0.012;
          const fx = (((f.fx + drift) % 1) + 1) % 1;
          ctx.globalAlpha = 0.5 + ((f.r - 0.9) / 1.8) * 0.45;
          ctx.beginPath();
          ctx.arc(fx * vw, f.fy * vh, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // expose deterministic state for the headless play-test
      (window as unknown as { __atlas?: unknown }).__atlas = {
        getState: () => ({
          x: Math.round(posRef.current.x),
          y: Math.round(posRef.current.y),
          door: doorIdRef.current,
          preview: previewIdRef.current,
          frames: framesRef.current,
          keys: [...keysRef.current],
          pad: { ...padRef.current },
          target: targetRef.current
            ? { x: Math.round(targetRef.current.x), y: Math.round(targetRef.current.y) }
            : null,
          snow: snowRef.current,
          flakeCount: flakes.length,
          minimap: {
            collapsed: !miniOpenRef.current,
            avatar: {
              x: Math.round(posRef.current.x * MM_SCALE),
              y: Math.round(posRef.current.y * MM_SCALE),
            },
          },
          ready: true,
        }),
      };

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (!engagedRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        e.preventDefault();
        if (down) keysRef.current.add(key);
        else keysRef.current.delete(key);
      }
    };
    const kd = onKey(true);
    const ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      delete (window as unknown as { __atlas?: unknown }).__atlas;
    };
  }, []);

  const engage = () => {
    engagedRef.current = true;
    setEngaged(true);
  };

  const toggleSnow = () => {
    const v = !snowRef.current;
    snowRef.current = v;
    setSnow(v);
    try {
      localStorage.setItem(SNOW_KEY, v ? "1" : "0");
    } catch {
      // storage unavailable (private mode): the toggle still works this visit
    }
  };

  const toggleMini = () => {
    const v = !miniOpenRef.current;
    miniOpenRef.current = v;
    setMiniOpen(v);
  };

  // --- previews: pointer geometry ---------------------------------------
  const worldFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { w: vw, h: vh } = viewRef.current;
    const camX = Math.max(0, Math.min(WORLD_W - vw, posRef.current.x - vw / 2));
    const camY = Math.max(0, Math.min(WORLD_H - vh, posRef.current.y - vh / 2));
    return { x: clientX - rect.left + camX, y: clientY - rect.top + camY };
  };
  const buildingFromWorld = (x: number, y: number): Building | undefined =>
    buildingAt(Math.floor(x / TILE), Math.floor(y / TILE)) ?? doorNear(x, y);

  const onCanvasHover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") return; // touch has no hover; it long-presses
    pressIdRef.current = null; // live pointer work supersedes a held preview
    const w = worldFromClient(e.clientX, e.clientY);
    applyHover(w ? (buildingFromWorld(w.x, w.y)?.id ?? null) : null);
  };

  // Press handling shared by the canvas and the door markers. Mouse/pen
  // keep the original behaviour (press = walk there, immediately). Touch
  // defers the walk until release: a quick tap walks, a hold of
  // LONG_PRESS_MS raises the preview instead and never walks.
  const beginPress = (
    e: React.PointerEvent,
    target: { x: number; y: number },
    pressId: string | null,
  ) => {
    engage();
    pressIdRef.current = null; // a new press supersedes a held preview
    syncPreview();
    if (e.pointerType !== "touch") {
      targetRef.current = target;
      return;
    }
    const info = {
      pointerId: e.pointerId,
      target,
      pressId,
      fired: false,
      timer: setTimeout(() => {
        info.fired = true;
        if (info.pressId) applyPress(info.pressId);
      }, LONG_PRESS_MS),
    };
    pressInfoRef.current = info;
  };
  const endPress = (e: React.PointerEvent) => {
    const info = pressInfoRef.current;
    if (!info || info.pointerId !== e.pointerId) return;
    clearTimeout(info.timer);
    pressInfoRef.current = null;
    if (!info.fired) targetRef.current = info.target; // quick tap: walk there
  };
  const cancelPress = (e: React.PointerEvent) => {
    const info = pressInfoRef.current;
    if (!info || info.pointerId !== e.pointerId) return;
    clearTimeout(info.timer);
    pressInfoRef.current = null;
  };

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    beginPress(e, w, buildingFromWorld(w.x, w.y)?.id ?? null);
  };

  const padProps = (x: number, y: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engage();
      padRef.current = { x, y };
    },
    onPointerUp: () => {
      padRef.current = { x: 0, y: 0 };
    },
    onPointerLeave: () => {
      padRef.current = { x: 0, y: 0 };
    },
    onPointerCancel: () => {
      padRef.current = { x: 0, y: 0 };
    },
  });

  const padBtn =
    "flex h-12 w-12 items-center justify-center rounded-lg border border-green-500/60 bg-green-900/70 text-lg text-green-200 active:bg-green-700/70 touch-none select-none";

  return (
    <div data-testid="quest-atlas">
      <div className="mb-2 flex items-center justify-end gap-2">
        <span className="text-sm text-gray-400">Winter skin for the map:</span>
        <button
          type="button"
          data-testid="snow-toggle"
          aria-pressed={snow}
          onClick={toggleSnow}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
            snow
              ? "border-sky-300 bg-sky-100 text-sky-900"
              : "border-green-500/60 bg-green-900/70 text-green-200 hover:bg-green-800/70"
          }`}
        >
          ❄ Snow: {snow ? "On" : "Off"}
        </button>
      </div>

      <div ref={wrapRef} className="relative w-full">
        <div className="relative">
          <canvas
            ref={canvasRef}
            data-testid="atlas-canvas"
            className="block w-full cursor-pointer touch-none rounded-lg border-2 border-green-600/60 bg-green-950"
            style={{ width: "100%" }}
            onPointerDown={onCanvasPointer}
            onPointerMove={onCanvasHover}
            onPointerLeave={() => applyHover(null)}
            onPointerUp={endPress}
            onPointerCancel={cancelPress}
            aria-label="Playable map of Matrix Hub. Walk to a building to open its door."
            role="img"
          />

          {/* minimap — same atlas.ts data, pre-rendered; collapsible */}
          <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            <button
              type="button"
              data-testid="minimap-toggle"
              aria-expanded={miniOpen}
              aria-controls="atlas-minimap"
              onClick={toggleMini}
              className="rounded border border-green-500/60 bg-gray-900/85 px-2 py-0.5 text-xs font-semibold text-green-200 hover:bg-gray-800"
            >
              Minimap {miniOpen ? "▾" : "▸"}
            </button>
            <canvas
              ref={miniRef}
              id="atlas-minimap"
              data-testid="minimap"
              width={MM_W}
              height={MM_H}
              className={`${miniOpen ? "block" : "hidden"} rounded border border-green-500/50 bg-green-950/85 shadow-lg`}
              style={{ width: `${MM_W}px`, height: `${MM_H}px` }}
              aria-label="Minimap of the Quest Atlas town, with your position marked."
              role="img"
            />
          </div>

          {/* door markers — one keyboard-focusable zone per building,
              projected over its door point each frame by the render loop.
              Transparent until focused; focusing (or hovering) raises the
              building's preview, and pressing one walks you to its door. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {FOCUS_ORDER.map((b) => (
              <button
                key={b.id}
                ref={(el) => {
                  if (el) zoneRefs.current.set(b.id, el);
                  else zoneRefs.current.delete(b.id);
                }}
                type="button"
                data-testid={`zone-${b.id}`}
                aria-label={`Preview ${b.name}`}
                className="pointer-events-auto absolute left-0 top-0 h-11 w-11 touch-none rounded-full bg-transparent focus-visible:bg-sky-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                style={{ transform: "translate(-100px, -100px)", visibility: "hidden" }}
                onFocus={() => applyFocus(b.id)}
                onBlur={() => applyFocus(null)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") applyHover(b.id);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== "touch") applyHover(null);
                }}
                onPointerDown={(e) => beginPress(e, doorPoint(b), b.id)}
                onPointerUp={endPress}
                onPointerCancel={cancelPress}
              />
            ))}
          </div>
        </div>

      {preview && (
        <div
          data-testid="preview-card"
          className="pointer-events-none absolute left-3 top-14 z-[6] max-w-[16rem] rounded-lg border-2 border-sky-400 bg-gray-900/95 p-3 shadow-xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
            Preview
          </p>
          <h3 className="text-base font-bold text-sky-200">{preview.name}</h3>
          <p className="mt-1 text-sm text-gray-300">{preview.blurb}</p>
        </div>
      )}

      {door && (
        <div
          data-testid="door-card"
          aria-live="polite"
          className="absolute inset-x-3 bottom-3 rounded-lg border-2 border-amber-400 bg-gray-900/95 p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-amber-300">{door.name}</h3>
            <button
              type="button"
              onClick={() => {
                doorIdRef.current = null;
                setDoor(null);
              }}
              className="rounded px-2 py-0.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              aria-label="Close door card"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-300">{door.blurb}</p>
          <a
            data-testid="door-enter"
            href={door.href}
            className="mt-3 inline-block rounded bg-amber-500 px-4 py-2 font-semibold text-gray-900 hover:bg-amber-400"
          >
            {door.enterLabel} →
          </a>
        </div>
      )}

      <p className="mt-2 text-sm text-gray-400" aria-live="polite">
        {engaged
          ? "Controls live — walk with WASD or the arrow keys, tap the map to walk somewhere, or use the pad. Step up to a door to open it. Hover a building, tab to a door marker, or press and hold on touch to preview it first."
          : "Click or tap the map to take control, then walk with WASD or the arrow keys — or tap anywhere to walk there. Hover a building to preview it before you walk over."}
      </p>

      {/* thumb pad (touch first; harmless on desktop) */}
      <div className="mt-2 flex items-center justify-center gap-1.5 md:hidden" aria-label="Walk pad">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <button type="button" className={padBtn} aria-label="Walk up" {...padProps(0, -1)}>
            ▲
          </button>
          <span />
          <button type="button" className={padBtn} aria-label="Walk left" {...padProps(-1, 0)}>
            ◀
          </button>
          <button type="button" className={padBtn} aria-label="Walk down" {...padProps(0, 1)}>
            ▼
          </button>
          <button type="button" className={padBtn} aria-label="Walk right" {...padProps(1, 0)}>
            ▶
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
