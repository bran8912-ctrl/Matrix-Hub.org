// Quest Atlas — map data and rules for the Clubhouse's playable front door.
//
// The map is generated programmatically (paths, plaza, scatter) from the
// building table below, so the game island and the page's accessible door
// list render from ONE source of truth. All art is drawn in code by the
// island — no image assets, no external files, nothing scraped.
//
// Engine note: the atlas needs exactly four engine features — tile
// rendering, AABB collision, a follow camera, and zone triggers. Neither
// melonJS nor KAPLAY is installed in this site tree (no npm dependency;
// node_modules is a shared symlink), and vendoring a ~1 MB engine for
// four features would break the page's performance law. The island
// therefore hand-rolls those four features in a few hundred lines and
// ships as a small React chunk. See the Phase 4 report for the full
// justification.

export const TILE = 32;
export const COLS = 46;
export const ROWS = 34;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

export interface Building {
  id: string;
  /** Full name, used in the door card and the accessible list. */
  name: string;
  /** Short label painted on the building's sign in-world. */
  sign: string;
  /** One line: what this place is. Claims-checked, no hype. */
  blurb: string;
  /** The real route the door opens. */
  href: string;
  /** Label on the door card's enter link. */
  enterLabel: string;
  /** Footprint in tiles (solid). */
  rect: { x: number; y: number; w: number; h: number };
  /** Passable tile in front of the door; its centre is the trigger point. */
  doorTile: { x: number; y: number };
  body: string;
  roof: string;
}

export const BUILDINGS: Building[] = [
  {
    id: "proving-ground",
    name: "The Proving Ground",
    sign: "PROVING GROUND",
    blurb:
      "Hands-on MTX training: spot the fake contract, watch a mint happen, read a verified contract like a pro.",
    href: "/proving-ground/",
    enterLabel: "Enter the Proving Ground",
    rect: { x: 2, y: 14, w: 5, h: 6 },
    doorTile: { x: 7, y: 17 },
    body: "#14532d",
    roof: "#16a34a",
  },
  {
    id: "casino",
    name: "The Casino",
    sign: "CASINO",
    blurb:
      "Dice is live for MTX on Polygon today; the other games are still in testnet development.",
    href: "/games/casino/",
    enterLabel: "Enter the Casino",
    rect: { x: 39, y: 14, w: 5, h: 6 },
    doorTile: { x: 38, y: 17 },
    body: "#713f12",
    roof: "#eab308",
  },
  {
    id: "glass-wall",
    name: "The Glass Wall",
    sign: "GLASS WALL",
    blurb:
      "The Clubhouse's transparency room: live chain reads, site status and receipts — shown, not asserted.",
    href: "/clubhouse/glass-wall",
    enterLabel: "Enter the Glass Wall",
    rect: { x: 3, y: 3, w: 6, h: 5 },
    doorTile: { x: 5, y: 8 },
    body: "#164e63",
    roof: "#0e7490",
  },
  {
    id: "classroom",
    name: "MTX 101 Classroom",
    sign: "CLASSROOM",
    blurb:
      "The MTX 101 lesson series as decks you can flip through in order, at your own pace.",
    href: "/clubhouse/classroom",
    enterLabel: "Enter the Classroom",
    rect: { x: 17, y: 3, w: 5, h: 5 },
    doorTile: { x: 19, y: 8 },
    body: "#581c87",
    roof: "#9333ea",
  },
  {
    id: "studio",
    name: "The Reel Foundry — Studio Room",
    sign: "STUDIO",
    blurb:
      "The Video Studio's trial room: the reel tools running in your browser, on your own device.",
    href: "/clubhouse/studio",
    enterLabel: "Enter the Studio Room",
    rect: { x: 37, y: 3, w: 6, h: 5 },
    doorTile: { x: 39, y: 8 },
    body: "#7c2d12",
    roof: "#ea580c",
  },
  {
    id: "academy",
    name: "The Academy",
    sign: "ACADEMY",
    blurb: "MPL Coach and the Shipfitter Academy — structured lessons with a coach's eye on your game.",
    href: "/academy/",
    enterLabel: "Enter the Academy",
    rect: { x: 2, y: 26, w: 5, h: 5 },
    doorTile: { x: 7, y: 28 },
    body: "#1e3a8a",
    roof: "#3b82f6",
  },
  {
    id: "video-studio",
    name: "Video Studio",
    sign: "VIDEO STUDIO",
    blurb: "Short ads, product videos and short movie scenes — the studio's order desk and price list.",
    href: "/video-studio/",
    enterLabel: "Enter the Video Studio",
    rect: { x: 39, y: 26, w: 5, h: 5 },
    doorTile: { x: 38, y: 28 },
    body: "#831843",
    roof: "#ec4899",
  },
  {
    id: "daily-drop",
    name: "The Daily Drop Kiosk",
    sign: "DAILY DROP",
    blurb:
      "A fresh Spot-the-Fake challenge every day — the Drop opens with the Clubhouse core. Until then, this kiosk takes you straight to the trainer it runs on.",
    href: "/proving-ground/spot-the-fake/",
    enterLabel: "Train at Spot the Fake",
    rect: { x: 18, y: 26, w: 4, h: 3 },
    doorTile: { x: 19, y: 25 },
    body: "#134e4a",
    roof: "#2dd4bf",
  },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inRect = (x: number, y: number, r: Rect) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Stone plaza at the centre of the map. */
export const PLAZA: Rect = { x: 17, y: 13, w: 12, h: 9 };

/** Twin fountain basins flanking Main Street in the plaza (solid, decorative). */
export const FOUNTAINS: Rect[] = [
  { x: 19, y: 16, w: 2, h: 3 },
  { x: 25, y: 16, w: 2, h: 3 },
];

const PATHS: Rect[] = [
  { x: 22, y: 1, w: 2, h: 32 }, // Main Street — runs clear from the south gate to the north hedge
  { x: 2, y: 11, w: 42, h: 2 }, // North Avenue
  { x: 2, y: 23, w: 42, h: 2 }, // South Avenue
  { x: 7, y: 11, w: 2, h: 21 }, // West Walk
  { x: 37, y: 11, w: 2, h: 21 }, // East Walk
  { x: 5, y: 8, w: 2, h: 3 }, // Glass Wall spur
  { x: 19, y: 8, w: 2, h: 3 }, // Classroom spur
  { x: 39, y: 8, w: 2, h: 3 }, // Studio spur
  { x: 18, y: 25, w: 4, h: 1 }, // Daily Drop apron
];

export type GroundKind = "grass" | "plaza" | "path";

export function groundAt(tx: number, ty: number): GroundKind {
  if (inRect(tx, ty, PLAZA)) return "plaza";
  for (const p of PATHS) if (inRect(tx, ty, p)) return "path";
  return "grass";
}

export function isFountain(tx: number, ty: number): boolean {
  return FOUNTAINS.some((f) => inRect(tx, ty, f));
}

export function buildingAt(tx: number, ty: number): Building | undefined {
  return BUILDINGS.find((b) => inRect(tx, ty, b.rect));
}

/** Player spawn, just inside the south hedge on Main Street. */
export const SPAWN_TILE = { x: 22, y: 31 };

// Deterministic scatter (seeded PRNG) so the map is identical on every
// load and every device — and so the play-test can rely on it.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x: number, y: number) => `${x},${y}`;

function scatter(count: number, passableOnly: boolean, seed: number): Set<string> {
  const rand = mulberry32(seed);
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < 3000) {
    const x = 1 + Math.floor(rand() * (COLS - 2));
    const y = 1 + Math.floor(rand() * (ROWS - 2));
    if (groundAt(x, y) !== "grass") continue;
    if (buildingAt(x, y)) continue;
    // Keep clearings around every door and around the spawn.
    if (BUILDINGS.some((b) => Math.abs(b.doorTile.x - x) <= 1 && Math.abs(b.doorTile.y - y) <= 1)) continue;
    if (Math.abs(x - SPAWN_TILE.x) <= 2 && Math.abs(y - SPAWN_TILE.y) <= 2) continue;
    if (passableOnly && out.has(key(x, y))) continue;
    out.add(key(x, y));
  }
  return out;
}

/** Trees are solid obstacles; flowers are walk-through decoration. */
export const TREES: Set<string> = scatter(46, true, 1337);
export const FLOWERS: Set<string> = scatter(36, false, 4242);

export function isSolidTile(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  if (tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1) return true; // hedge border
  if (buildingAt(tx, ty)) return true;
  if (isFountain(tx, ty)) return true;
  if (TREES.has(key(tx, ty))) return true;
  return false;
}

export const tileCenter = (tx: number, ty: number) => ({
  x: tx * TILE + TILE / 2,
  y: ty * TILE + TILE / 2,
});

/** Door trigger point (px) for a building. */
export function doorPoint(b: Building) {
  return tileCenter(b.doorTile.x, b.doorTile.y);
}

/** The building whose door the point is near, if any. */
export function doorNear(x: number, y: number, radius = 56): Building | undefined {
  let best: Building | undefined;
  let bestD = radius;
  for (const b of BUILDINGS) {
    const p = doorPoint(b);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}
