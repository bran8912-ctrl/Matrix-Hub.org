// Minimal types for the vendored html-to-image UMD build
// (./html-to-image.js — see that file's header for provenance + licence).
// Only the surface downloadResultCardPng() in src/lib/proving-ground.ts
// uses: toPng() with the three options set there.

export interface HtmlToImageOptions {
  /** Append a timestamp query to fetched resources, avoiding stale caches. */
  cacheBust?: boolean;
  /**
   * Skip webfont embedding. The result card uses system font stacks only,
   * so there is nothing to embed — skipping keeps the render deterministic.
   */
  skipFonts?: boolean;
  /** Output scale relative to the node's CSS size (2 = retina card). */
  pixelRatio?: number;
}

declare const htmlToImage: {
  toPng: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
};

export default htmlToImage;
