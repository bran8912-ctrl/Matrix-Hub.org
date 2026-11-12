/**
 * trends.ts - Trends posts for Matrix Hub (/trends)
 *
 * Source: Chloe Voss, Trends & News Lead — trends plan, November 10, 2026
 * (bot-core/growth/trends-plan-2026-11-10.md, section 3: First 5 posts).
 * Post headlines and bodies are reproduced exactly as written in that plan.
 * Do not rewrite, shorten, or embellish them.
 *
 * Rules from the plan:
 * - Site trends only for these seed posts; no gambling content, ever.
 * - MTX is the site's utility token, never an investment.
 * - Top of Trends shows the last 5 posts only.
 * - Posts older than 7 days move to a dated archive list.
 */

export interface TrendPost {
  /** ISO date, e.g. "2026-11-10" */
  date: string;
  /** Display date, as dated in the plan */
  dateLabel: string;
  headline: string;
  body: string;
  /** Plan section 1: "site" = Site trends, "world" = Matrix / crypto world news */
  kind: "site" | "world";
}

export const trendPosts: TrendPost[] = [
  {
    date: "2026-11-10",
    dateLabel: "Nov 10, 2026",
    headline: "Matrix Hub is live — free arcade games, no wallet needed",
    body: "Matrix Hub is live at matrix-hub.org, and the free arcade games are playable right now. There is nothing to install and no wallet needed to play them. If you are looking for a quick game in your browser, that is the place to start.",
    kind: "site",
  },
  {
    date: "2026-11-10",
    dateLabel: "Nov 10, 2026",
    headline: "MTX, explained: the utility token for Matrix Hub",
    body: "MTX is the utility token used on Matrix Hub, and it can be minted directly at a rate of 1 POL = 1,000 MTX. The verified MTX contract on Polygon is 0x53307e1db6c5cb6773c9495ca140372016dfe266. MTX is a utility token, not an investment, and it carries no guaranteed value or promised return.",
    kind: "site",
  },
  {
    date: "2026-11-11",
    dateLabel: "Nov 11, 2026",
    headline: "Find what's new on Matrix Hub in one place: the content feed",
    body: "Matrix Hub has a content feed at matrix-hub.org/content-feed that lists what is on the site, by category, with recent updates at the top. It is the fastest way to see what has been added or changed without clicking through every section. The same feed is also available as public data at matrix-hub.org/public-feed.json.",
    kind: "site",
  },
  {
    date: "2026-11-11",
    dateLabel: "Nov 11, 2026",
    headline: "More useful tools are on the way to Matrix Hub",
    body: "Matrix Hub is building out a tools section alongside its games, with useful simulators and everyday tools planned under Tools & Simulators Lead Ravi Desai. The first tools will be announced here when they are live and verified on the site. Until then, the free arcade games and the content feed are the best places to start.",
    kind: "site",
  },
  {
    date: "2026-11-11",
    dateLabel: "Nov 11, 2026",
    headline: "Watch this space: Matrix Hub's intro video is coming to YouTube",
    body: "Matrix Hub has a YouTube channel, Matrix Hub (@thematrixhub-q1s), and an intro video is being prepared to show what the site offers. There is no video on the channel yet, so this is a heads-up, not a launch — check back here and we will link it the day it goes live. In the meantime, the site itself is live at matrix-hub.org.",
    kind: "site",
  },
];
