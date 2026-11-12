/**
 * Matrix Hub — Referral Program, Phase 1 (HUB task 154)
 *
 * Implements Ivy Santos's approved design:
 * ~/workspace/matrix-hub/bot-core/growth/referral-design-2026-11-10.md
 *
 * localStorage-first. No backend, no accounts, no wallet/contract
 * interaction, no cookies, no third-party trackers. Nothing leaves the
 * device in Phase 1.
 *
 * Hard rules (from the design — never violate):
 * - Rewards are site perks and recognition only: badges and game themes.
 * - NEVER cash, NEVER crypto payouts, NEVER promised returns.
 * - Referral perks never include MTX, POL, or any token transfer.
 * - A referral counts only when the invited friend completes a game
 *   round — never on a click, a visit, or a wallet connect.
 *
 * Phase 1 scope:
 * - Invite card data (code, link, counts, tier progress).
 * - `?ref=` capture: first-inviter-wins, self-referral ignored.
 * - Manual single-use receipt codes: the friend's browser issues a
 *   receipt after a completed round; the inviter enters it once.
 *   Receipts are bound to one inviter code and expire after 7 days.
 * - Tier 1 perk only: "First Friend" badge for the inviter;
 *   "Welcome to the Hub" badge + "Neon Grid" theme for the friend.
 *   Tiers 2–4 are displayed on the ladder as "Coming soon"; their
 *   perks are not built in Phase 1. There is no leaderboard /
 *   "Top Connectors" board in Phase 1.
 */

/* ── localStorage keys (design §2 — namespaced `mh_ref_*`) ────────── */

export const REF_KEYS = {
  myCode: "mh_ref_my_code",
  invitedBy: "mh_ref",
  count: "mh_ref_count",
  credited: "mh_ref_credited",
  invitesSent: "mh_ref_invites_sent",
  tier: "mh_ref_tier",
  badges: "mh_ref_badges",
  /** Implementation keys, same namespace: */
  browserId: "mh_ref_browser_id",
  usedReceipts: "mh_ref_used_receipts",
  myReceipt: "mh_ref_my_receipt",
  unlockedThemes: "mh_ref_unlocked_themes",
  theme: "mh_theme",
} as const;

/* ── Invite codes ─────────────────────────────────────────────────── */

/** Uppercase letters + digits only (design §1). Ambiguous glyphs
 *  (I, O, 0, 1) are excluded when generating so codes are easy to
 *  read aloud and type; validation accepts any A–Z / 0–9 code. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;

export function normalizeInviteCode(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidInviteCode(raw: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeInviteCode(raw));
}

function randomFromAlphabet(alphabet: string, length: number): string {
  let out = "";
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateInviteCode(): string {
  return randomFromAlphabet(CODE_ALPHABET, INVITE_CODE_LENGTH);
}

/** Invite link format (design §1): `https://matrix-hub.org/?ref=XXXXXX` */
export function buildInviteLink(code: string, origin?: string): string {
  const base = (origin || "https://matrix-hub.org").replace(/\/$/, "");
  return `${base}/?ref=${normalizeInviteCode(code)}`;
}

/* ── Tiers (design §4 — full ladder always visible) ───────────────── */

export interface ReferralTier {
  id: string;
  level: number;
  name: string;
  emoji: string;
  threshold: number;
  unlockText: string;
}

export const TIERS: ReferralTier[] = [
  {
    id: "first-friend",
    level: 1,
    name: "First Friend",
    emoji: "🌱",
    threshold: 1,
    unlockText:
      '"First Friend" badge on the Invite card. Your friend also gets the "Welcome to the Hub" badge + "Neon Grid" theme after their first game.',
  },
  {
    id: "connector",
    level: 2,
    name: "Connector",
    emoji: "🔗",
    threshold: 5,
    unlockText: '"Connector" badge. Unlocks the "Gold Rush" game theme.',
  },
  {
    id: "hub-builder",
    level: 3,
    name: "Hub Builder",
    emoji: "🏗️",
    threshold: 10,
    unlockText: '"Hub Builder" badge. Unlocks the "Void Purple" game theme.',
  },
  {
    id: "matrix-legend",
    level: 4,
    name: "Matrix Legend",
    emoji: "👑",
    threshold: 25,
    unlockText:
      '"Matrix Legend" badge. Unlocks all themes, including the exclusive "Legend" theme.',
  },
];

/** Highest tier whose threshold the count has reached (display only —
 *  in Phase 1 only the Tier 1 perk is actually delivered). */
export function tierReachedForCount(count: number): ReferralTier | null {
  let reached: ReferralTier | null = null;
  for (const tier of TIERS) {
    if (count >= tier.threshold) reached = tier;
  }
  return reached;
}

export function nextTierForCount(count: number): ReferralTier | null {
  for (const tier of TIERS) {
    if (count < tier.threshold) return tier;
  }
  return null;
}

/* ── Receipt codes (design §2 — manual, single-use, 7-day expiry) ─── */

export const RECEIPT_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function daysSinceEpoch(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_DAY);
}

/** Small deterministic hash → base36, used to bind a receipt suffix to
 *  the friend's per-browser ID + inviter code + issue day, so the same
 *  browser re-displays the same receipt instead of minting new ones,
 *  and a receipt cannot be re-pointed at a different inviter. */
function hashBase36(input: string, length: number): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  const combined = (h1.toString(36) + h2.toString(36)).toUpperCase();
  return (combined + "XXXXXXXX").slice(0, length);
}

/**
 * Receipt format: `PLAYED-<INVITER>-<SUFFIX>`
 * SUFFIX (6 chars) = 3-char base36 issue day (days since epoch) +
 * 3 check chars bound to the friend's browser ID and the inviter code.
 * The embedded issue day is what lets the inviter's browser enforce
 * the design's 7-day expiry with no backend.
 */
export function buildReceiptCode(
  inviterCode: string,
  browserId: string,
  nowMs: number = Date.now(),
): string {
  const inviter = normalizeInviteCode(inviterCode);
  const day36 = daysSinceEpoch(nowMs).toString(36).toUpperCase().padStart(3, "0");
  const check = hashBase36(`${browserId}|${inviter}|${day36}`, 3);
  return `PLAYED-${inviter}-${day36}${check}`;
}

export interface ParsedReceipt {
  ok: boolean;
  inviterCode: string;
  issuedDay: number | null;
  ageDays: number | null;
  expired: boolean;
}

export function parseReceiptCode(
  raw: string,
  nowMs: number = Date.now(),
): ParsedReceipt {
  const cleaned = (raw || "").toUpperCase().trim();
  const match = /^PLAYED-([A-Z0-9]{6})-([A-Z0-9]{6})$/.exec(cleaned);
  if (!match) {
    return { ok: false, inviterCode: "", issuedDay: null, ageDays: null, expired: false };
  }
  const issuedDay = parseInt(match[2].slice(0, 3), 36);
  if (!Number.isFinite(issuedDay)) {
    return { ok: false, inviterCode: match[1], issuedDay: null, ageDays: null, expired: false };
  }
  const ageDays = daysSinceEpoch(nowMs) - issuedDay;
  return {
    ok: true,
    inviterCode: match[1],
    issuedDay,
    ageDays,
    expired: ageDays > RECEIPT_TTL_DAYS || ageDays < 0,
  };
}

export function normalizeReceiptCode(raw: string): string {
  return (raw || "").toUpperCase().trim();
}

/* ── Storage helpers ──────────────────────────────────────────────── */

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* storage unavailable (private mode, blocked) — Phase 1 degrades
       to "no saved state" rather than breaking the page. */
  }
  return null;
}

function readString(store: StorageLike, key: string): string {
  try {
    return store.getItem(key) || "";
  } catch {
    return "";
  }
}

function readInt(store: StorageLike, key: string): number {
  const n = parseInt(readString(store, key), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readList(store: StorageLike, key: string): string[] {
  try {
    const parsed = JSON.parse(readString(store, key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeList(store: StorageLike, key: string, list: string[]): void {
  try {
    store.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/* ── Per-browser identity (design §2: a local, random, per-browser
 *     ID stored in localStorage — no fingerprinting beyond this) ──── */

export function ensureBrowserId(store: StorageLike): string {
  let id = readString(store, REF_KEYS.browserId);
  if (!id) {
    id = randomFromAlphabet(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      16,
    );
    try {
      store.setItem(REF_KEYS.browserId, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

/** The visitor's own invite code — generated once per browser and
 *  stored (design §1). Random; never derived from a wallet address,
 *  name, or email. */
export function ensureMyCode(store: StorageLike): string {
  let code = normalizeInviteCode(readString(store, REF_KEYS.myCode));
  if (!isValidInviteCode(code)) {
    code = generateInviteCode();
    try {
      store.setItem(REF_KEYS.myCode, code);
    } catch {
      /* ignore */
    }
  }
  return code;
}

/* ── Invite capture (?ref= landing + "Got an invite code?") ───────── */

export type CaptureStatus =
  | "saved"
  | "already-saved"
  | "kept-existing"
  | "self"
  | "invalid";

export interface CaptureResult {
  status: CaptureStatus;
  code: string;
}

/**
 * Save an inviter code for this browser.
 * - First inviter wins: an existing saved code is never overwritten.
 * - Self-referral is ignored: your own code is never stored.
 */
export function captureInvite(store: StorageLike, rawCode: string): CaptureResult {
  const code = normalizeInviteCode(rawCode);
  if (!isValidInviteCode(code)) return { status: "invalid", code };
  const myCode = ensureMyCode(store);
  if (code === myCode) return { status: "self", code };
  const existing = normalizeInviteCode(readString(store, REF_KEYS.invitedBy));
  if (existing) {
    return { status: existing === code ? "already-saved" : "kept-existing", code: existing };
  }
  try {
    store.setItem(REF_KEYS.invitedBy, code);
  } catch {
    /* ignore */
  }
  return { status: "saved", code };
}

/** Read `?ref=` from a URL, capture it, and return the code + result.
 *  Callers strip the param from the address bar (design §1). */
export function captureInviteFromUrl(
  store: StorageLike,
  url: URL,
): CaptureResult | null {
  const raw = url.searchParams.get("ref");
  if (!raw) return null;
  return captureInvite(store, raw);
}

/* ── Invite card state ────────────────────────────────────────────── */

export interface ReferralState {
  myCode: string;
  inviteLink: string;
  count: number;
  invitesSent: number;
  tierId: string;
  badges: string[];
  invitedBy: string;
  creditedInviters: string[];
  myReceipt: string;
  unlockedThemes: string[];
  activeTheme: string;
}

export function getReferralState(
  store: StorageLike,
  origin?: string,
): ReferralState {
  const myCode = ensureMyCode(store);
  return {
    myCode,
    inviteLink: buildInviteLink(myCode, origin),
    count: readInt(store, REF_KEYS.count),
    invitesSent: readInt(store, REF_KEYS.invitesSent),
    tierId: readString(store, REF_KEYS.tier),
    badges: readList(store, REF_KEYS.badges),
    invitedBy: normalizeInviteCode(readString(store, REF_KEYS.invitedBy)),
    creditedInviters: readList(store, REF_KEYS.credited),
    myReceipt: readString(store, REF_KEYS.myReceipt),
    unlockedThemes: readList(store, REF_KEYS.unlockedThemes),
    activeTheme: readString(store, REF_KEYS.theme),
  };
}

/** Copy / Share taps are a vanity metric only, never a perk
 *  (design §2). The UI adds a cooldown after rapid taps. */
export function recordInviteSent(store: StorageLike): number {
  const next = readInt(store, REF_KEYS.invitesSent) + 1;
  try {
    store.setItem(REF_KEYS.invitesSent, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

function addBadge(store: StorageLike, badgeId: string): void {
  const badges = readList(store, REF_KEYS.badges);
  if (!badges.includes(badgeId)) {
    badges.push(badgeId);
    writeList(store, REF_KEYS.badges, badges);
  }
}

/* ── Friend side: credit on a completed game round ────────────────── */

export type CompleteStatus =
  | "credited"
  | "already-credited"
  | "not-invited"
  | "self";

export interface CompleteResult {
  status: CompleteStatus;
  receipt: string;
  inviterCode: string;
}

/**
 * Called when a game round is completed on the invited friend's
 * browser. On first completion for an inviter it:
 * - records the credit locally for the friend (`mh_ref_credited`),
 * - unlocks the friend's Tier 1 perks: the "Welcome to the Hub"
 *   badge and the "Neon Grid" theme (design §4, Tier 1),
 * - issues the single receipt code the friend shares back with the
 *   inviter (design §2 — manual receipt flow, no backend).
 */
export function completeInvitedGameRound(
  store: StorageLike,
  nowMs: number = Date.now(),
): CompleteResult {
  const inviterCode = normalizeInviteCode(readString(store, REF_KEYS.invitedBy));
  if (!inviterCode) return { status: "not-invited", receipt: "", inviterCode: "" };
  const myCode = ensureMyCode(store);
  if (inviterCode === myCode) {
    return { status: "self", receipt: "", inviterCode };
  }
  const credited = readList(store, REF_KEYS.credited);
  if (credited.includes(inviterCode)) {
    return {
      status: "already-credited",
      receipt: readString(store, REF_KEYS.myReceipt),
      inviterCode,
    };
  }
  const browserId = ensureBrowserId(store);
  const receipt = buildReceiptCode(inviterCode, browserId, nowMs);
  credited.push(inviterCode);
  writeList(store, REF_KEYS.credited, credited);
  try {
    store.setItem(REF_KEYS.myReceipt, receipt);
  } catch {
    /* ignore */
  }
  addBadge(store, "welcome-to-the-hub");
  const themes = readList(store, REF_KEYS.unlockedThemes);
  if (!themes.includes("neon-grid")) {
    themes.push("neon-grid");
    writeList(store, REF_KEYS.unlockedThemes, themes);
  }
  return { status: "credited", receipt, inviterCode };
}

/* ── Inviter side: redeem a receipt code (single use) ─────────────── */

export type RedeemStatus =
  | "ok"
  | "invalid-format"
  | "wrong-inviter"
  | "expired"
  | "already-used"
  | "own-receipt";

export interface RedeemResult {
  status: RedeemStatus;
  count: number;
  /** True when this redemption is the one that reaches Tier 1. */
  unlockedFirstFriend: boolean;
}

/**
 * Add +1 credited referral from a friend's receipt code.
 * Rejects: malformed codes, codes bound to a different inviter,
 * codes older than 7 days, codes already redeemed on this browser,
 * and receipts this same browser issued for itself.
 */
export function redeemReceipt(
  store: StorageLike,
  rawReceipt: string,
  nowMs: number = Date.now(),
): RedeemResult {
  const count = readInt(store, REF_KEYS.count);
  const receipt = normalizeReceiptCode(rawReceipt);
  const parsed = parseReceiptCode(receipt, nowMs);
  if (!parsed.ok) return { status: "invalid-format", count, unlockedFirstFriend: false };

  const myCode = ensureMyCode(store);
  if (parsed.inviterCode !== myCode) {
    return { status: "wrong-inviter", count, unlockedFirstFriend: false };
  }
  if (receipt === readString(store, REF_KEYS.myReceipt)) {
    return { status: "own-receipt", count, unlockedFirstFriend: false };
  }
  if (parsed.expired) return { status: "expired", count, unlockedFirstFriend: false };

  const used = readList(store, REF_KEYS.usedReceipts);
  if (used.includes(receipt)) {
    return { status: "already-used", count, unlockedFirstFriend: false };
  }
  used.push(receipt);
  writeList(store, REF_KEYS.usedReceipts, used);

  const next = count + 1;
  try {
    store.setItem(REF_KEYS.count, String(next));
  } catch {
    /* ignore */
  }

  // Phase 1 delivers the Tier 1 perk only. Higher counts are recorded
  // honestly and shown on the ladder, but Tiers 2–4 perks are not
  // built yet (design §5) and are never marked unlocked here.
  let unlockedFirstFriend = false;
  if (next >= TIERS[0].threshold && !readList(store, REF_KEYS.badges).includes("first-friend")) {
    addBadge(store, "first-friend");
    try {
      store.setItem(REF_KEYS.tier, TIERS[0].id);
    } catch {
      /* ignore */
    }
    unlockedFirstFriend = count < TIERS[0].threshold;
  }
  return { status: "ok", count: next, unlockedFirstFriend };
}

/* ── Game themes (design §3/§5 — "Neon Grid" works in Phase 1) ────── */

export const NEON_GRID_THEME = "neon-grid";

export function isThemeUnlocked(store: StorageLike, themeId: string): boolean {
  return readList(store, REF_KEYS.unlockedThemes).includes(themeId);
}

/** Apply an unlocked theme (or "" for the site default). Returns
 *  false without changing anything when the theme is still locked. */
export function applyTheme(store: StorageLike, themeId: string): boolean {
  if (themeId && !isThemeUnlocked(store, themeId)) return false;
  try {
    if (themeId) store.setItem(REF_KEYS.theme, themeId);
    else store.removeItem(REF_KEYS.theme);
  } catch {
    /* ignore */
  }
  return true;
}
