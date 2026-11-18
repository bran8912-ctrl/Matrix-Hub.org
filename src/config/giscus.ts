/**
 * Giscus comments configuration — the SINGLE config spot for the
 * GiscusComments component (src/components/GiscusComments.astro).
 *
 * Values come from the repo-side Giscus setup for
 * bran8912-ctrl/Matrix-Hub.org (GitHub Discussions enabled, Giscus app
 * installed on this repo, "Announcements" category) and were verified
 * against giscus.app by HQ on 2026-11-17. If the Discussions category
 * is ever renamed or recreated in the repo settings, update
 * category/categoryId here — nowhere else.
 */
export const giscusConfig = {
  repo: "bran8912-ctrl/Matrix-Hub.org",
  repoId: "R_kgDOQd0yyA",
  category: "Announcements",
  categoryId: "DIC_kwDOQd0yyM4C0Z8v",
  /** One discussion per page path (e.g. /trends gets its own thread). */
  mapping: "pathname",
  strict: "0",
  reactionsEnabled: "1",
  emitMetadata: "0",
  inputPosition: "bottom",
  /** Site is dark-themed; keep comments dark to match. */
  theme: "dark",
  lang: "en",
} as const;
