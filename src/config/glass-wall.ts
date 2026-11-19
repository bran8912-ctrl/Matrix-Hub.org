/**
 * Glass Wall configuration — the SINGLE config spot for the Clubhouse's
 * live transparency room (/clubhouse/glass-wall, Clubhouse Phase 2).
 *
 * The Glass Wall has two external JSON feeds. Both are deliberately
 * EMPTY below until HQ wires the real publishers — while a URL is
 * empty, the page renders that panel's honest "being wired" state
 * instead of fetching anything. Never point these at a feed that does
 * not exist yet, and never hard-code feed URLs in components — this
 * file is the only place they live.
 *
 * ---------------------------------------------------------------------
 * STATUS FEED — site/service status, published by Upptime.
 *
 * The $0 Upptime setup lives in bot-core/clubhouse/upptime/ (config +
 * the exact repo-creation steps for HQ). Once that repo exists and its
 * first run publishes, set STATUS_FEED_URL to its summary JSON:
 *
 *   https://bran8912-ctrl.github.io/matrix-hub-status/api/summary.json
 *
 * Contract the panel consumes (it normalizes all three shapes):
 *   a) Ours:      { "checks": [ { "name": "Matrix Hub — Homepage",
 *                                 "status": "up",
 *                                 "updatedAt": "2026-11-18T13:05:00Z" } ],
 *                   "updatedAt": "2026-11-18T13:05:00Z" }
 *   b) Upptime native summary: a bare array of site objects with at
 *      least { "name": ..., "status": "up" | "down" } — extra fields
 *      (slug, uptime, response times) are ignored, and a missing
 *      per-check updatedAt falls back to the feed-level time.
 *   c) { "sites": [ ...same site objects as (b)... ] }
 * Status values are normalized: up/operational → up,
 * down/outage → down, degraded/partial → degraded, anything else →
 * unknown (shown as unknown, never guessed into "up").
 *
 * ---------------------------------------------------------------------
 * CREW LOG FEED — the automation runners' public log.
 *
 * Published by bot-core/clubhouse/publish-crew-log.mjs, which reads the
 * local runner logs, generalizes them into summaries (NO client data,
 * NO emails, NO credentials — summaries only), and writes crew-log.json.
 * HQ commits that file into this site's public/ folder on a cadence;
 * when the first publish lands, set CREW_LOG_FEED_URL to:
 *
 *   /crew-log.json
 *
 * Contract the panel consumes:
 *   { "generatedAt": "2026-11-18T14:00:00Z",
 *     "entries": [ { "ts": "2026-11-18T13:06:00Z",
 *                    "bot": "LINK Watch (HQ runner)",
 *                    "summary": "VRF LINK watch — subscription balance
 *                                above the alert threshold." } ] }
 * A bare array of entries is also accepted. Entries with an
 * unparseable timestamp or an empty bot/summary are dropped by the
 * panel; the rest are shown newest-first, capped at 20.
 */
export const STATUS_FEED_URL = "";
export const CREW_LOG_FEED_URL = "/crew-log.json";
