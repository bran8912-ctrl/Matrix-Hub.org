# Academy Prototype 01: From Blueprint to Fit-Up

The static Academy at `/academy/` teaches students to read a controlled drawing,
establish a datum, measure in millimetres, fit parts, check tolerances, correct
errors, and verify the result. Its seven blueprint modules include quizzes with
answer-specific coaching; tool selection, joint-preparation, position,
alignment, and ordered-workflow challenges run in the browser. Lesson and quiz
progress is stored only in the visitor's local browser storage.

The industrial page at `/industrial-simulation` embeds the Cocos build slot at
`/simulations/factory/` and includes a local mock checklist demo. Host/simulator
events are versioned and validated in `src/lib/academy/postMessage.ts`; the
scene plan and event payloads are documented in [`simulator-spec.md`](simulator-spec.md).
The build slot's `README.md` documents the static export and relative asset path.

All dimensions and visuals are schematic exercises, not fabrication
instructions. This feature teaches recognition, planning, and measurement; it
does not qualify or certify welders and cannot replace supervised hands-on
practice, approved procedures, required testing, or qualified inspection.
