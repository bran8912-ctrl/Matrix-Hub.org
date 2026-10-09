# Factory simulator scene and host contract

## Prototype scene

Build a compact shipyard fit-up training scene in Cocos Creator with:

- A steel base plate and one removable stiffener assembly, with clearly marked
  baseline, centerline, datum, part mark, and schematic dimensions.
- Camera orbit/inspect controls that also work with keyboard and touch; reset
  camera and focus controls must be available without relying on color alone.
- A tool tray with selectable tape, combination square, level, gap gauge,
  grinder, chipping hammer, and clamps. Tool selection is recognition practice,
  not an operating or safety qualification.
- Snapping and positioning for the stiffener, with measured offset and
  tolerance feedback; allow a student to reposition after a failed check.
- A measurement overlay for offset, squareness, plumb, root gap, and mismatch,
  showing units, nominal values, tolerances, and the drawing reference.
- Joint-preparation inspection options for bevel angle, root opening, root face,
  contamination, and burrs. Avoid suggesting that one generic preparation is
  correct for all work; the drawing and applicable WPS control.
- Check results, correction/re-check loop, final virtual inspection, and a
  step-by-step review in the sequence read drawing → establish reference →
  measure → fit → check → correct → verify.

The simulator is a static browser build. Do not add database, remote AI, paid
runtime service, or a runtime dependency. Export Cocos Creator Web Desktop or
Web Mobile files to `public/simulations/factory/`; use `/simulations/factory/`
as the base URL and relative URLs for assets. The separate
`bran8912-ctrl/cocos2d-x` repository is engine context only and must not be
vendored into this site.

## `postMessage` contract (version 1)

The simulator and parent page share an origin. The iframe sends plain JSON
objects to `window.parent` with `window.location.origin` as `targetOrigin`.
The host accepts messages only when both `event.origin === window.location.origin`
and `event.source === iframe.contentWindow`. Unknown types, malformed payloads,
non-finite measurements, and oversized strings/lists are ignored. The envelope:

```ts
{
  source: 'matrix-hub-simulator',
  version: 1,
  type: string,
  payload: object
}
```

Supported event payloads:

| Event | Payload |
| --- | --- |
| `tool-selected` | `{ toolId: string }` |
| `inspect-complete` | `{ component: 'base-plate', findings?: string[] }` |
| `joint-prep-flagged` | `{ defectIds: string[] }` |
| `reference-established` | `{ datum: string, baseline: string }` |
| `part-positioned` | `{ partId: string, offsetMm: number }` |
| `alignment-checked` | `{ checks: { id: string, passed: boolean }[] }` |
| `correction-applied` | `{ issue: string }` |
| `verification-complete` | `{ summary: string }` |
| `challenge-complete` | `{ score: number, verified: boolean }` |

Example:

```js
window.parent.postMessage({
  source: 'matrix-hub-simulator',
  version: 1,
  type: 'part-positioned',
  payload: { partId: 'ST-01', offsetMm: 125 }
}, window.location.origin);
```

The host maps inspected plate, identified preparation, established reference,
position, successful alignment, correction, and verification events to the
student checklist. A failed alignment remains incomplete until corrected and
checked again; `challenge-complete` only closes verification when `verified`
is true. The lightweight host mock uses the same event shape and validation
without depending on a Cocos build.

This scene is visual training only, not welder qualification, approved procedure
guidance, or a substitute for supervised practice, required testing, and
qualified inspection.
