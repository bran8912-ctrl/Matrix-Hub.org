export interface Lesson {
  id: string;
  level: string;
  title: string;
  summary: string;
  explanation: string;
  exercise: string;
  callouts: { label: string; description: string }[];
  question: string;
  answers: { text: string; correct: boolean; feedback: string }[];
}

export const lessons: Lesson[] = [
  {
    id: 'fundamentals',
    level: 'Level 1 · Shipyard fundamentals',
    title: 'Parts, people, and shop language',
    summary: 'Recognize the people, steel parts, and terms used during a basic fit-up.',
    explanation: 'A shipfitter lays out and fits parts to the drawing; a welder deposits the specified weld; a tack welder places temporary welds to hold a fit, and a helper supports safe material handling and preparation. Plate is flat stock. Stiffeners (including longitudinals), frames, webs, flanges, brackets, foundations, and bulkheads identify common structure. A drawing is the controlled instruction; a sketch communicates an idea, a detail enlarges a feature, and a revision records an approved change. Confirm the current revision and required PPE before work.',
    exercise: 'Select the labels on the sketch to identify the plate, stiffener web, and flange.',
    callouts: [
      { label: 'Plate', description: 'The broad, flat steel member supports the assembly.' },
      { label: 'Web', description: 'The upright portion of the stiffener resists shear and supports the flange.' },
      { label: 'Flange', description: 'The top face of this T stiffener adds bending strength.' },
    ],
    question: 'Which document controls the dimensions and revision for fabrication?',
    answers: [
      { text: 'The approved, current drawing', correct: true, feedback: 'Correct. Work from the controlled drawing and verify its revision.' },
      { text: 'An old shop sketch with no revision', correct: false, feedback: 'A sketch may help explain intent, but it does not replace the controlled drawing or revision.' },
      { text: 'A verbal estimate of the dimensions', correct: false, feedback: 'Never guess dimensions. Stop and resolve missing or conflicting information with the responsible lead.' },
    ],
  },
  {
    id: 'dimensions',
    level: 'Level 2 · Measurements and layout',
    title: 'Read dimensions without guessing',
    summary: 'Interpret millimetre dimensions, chain dimensions, baseline dimensions, and tolerances.',
    explanation: 'Dimensions state nominal geometry; tolerances state the permitted variation. In chain dimensioning, each segment starts where the prior one ends, so errors can accumulate. Baseline dimensions share a common origin and make each location independently traceable. Confirm units (this exercise uses mm), dimension arrows, and any tolerance in the title block or note before measuring.',
    exercise: 'Compare the chain and baseline dimensions shown; select each label for its meaning.',
    callouts: [
      { label: '600 mm', description: 'A segment dimension in a chain. Measure from the previous point, not from an assumed origin.' },
      { label: '1200 mm', description: 'The cumulative location from the baseline in this example.' },
      { label: '±2 mm', description: 'The allowed variation from nominal; it is not permission to round or guess.' },
    ],
    question: 'A part is located 1200 mm from the baseline with a ±2 mm tolerance. Which interval is acceptable?',
    answers: [
      { text: '1198–1202 mm from the baseline', correct: true, feedback: 'Correct. Apply the tolerance around the stated nominal and keep the stated reference.' },
      { text: '1198–1202 mm from the nearest plate edge', correct: false, feedback: 'The numeric range is right, but the reference is wrong. Measure from the drawing’s baseline.' },
      { text: 'Any value close to 1200 mm', correct: false, feedback: '“Close” is not a tolerance. Use the stated ±2 mm limit and units.' },
    ],
  },
  {
    id: 'references',
    level: 'Level 2 · Measurements and layout',
    title: 'Establish the reference system',
    summary: 'Distinguish a datum, baseline, centerline, station line, and offset.',
    explanation: 'A datum is the defined origin or reference from which measurements are controlled. A baseline runs along a chosen direction; a centerline divides a feature symmetrically; frame or station lines locate structure along the vessel; offset lines locate features away from a reference. Mark and protect the agreed references before transferring any dimensions.',
    exercise: 'Trace the baseline first, then use its intersection with the centerline as the datum.',
    callouts: [
      { label: 'Baseline', description: 'The horizontal reference used to locate the stiffener.' },
      { label: 'Centerline', description: 'The vertical reference dividing the plate into symmetric sides.' },
      { label: 'Datum', description: 'The marked origin where the baseline and centerline meet.' },
    ],
    question: 'Where should the 125 mm stiffener offset be measured from?',
    answers: [
      { text: 'From the specified baseline/datum', correct: true, feedback: 'Correct. Reproduce the drawing’s reference system on the plate before measuring.' },
      { text: 'From whichever plate edge is easiest to reach', correct: false, feedback: 'That substitutes a different origin. A reference error can shift the whole part even when the tape reading is accurate.' },
      { text: 'From the previous stiffener, without checking the drawing', correct: false, feedback: 'That can accumulate spacing error. The dimension type determines whether to use the baseline or prior part.' },
    ],
  },
  {
    id: 'weld-symbols',
    level: 'Level 3 · Blueprints and weld symbols',
    title: 'Read the weld symbol as an instruction',
    summary: 'Identify arrow side, other side, fillet and groove symbols, and supplementary notes.',
    explanation: 'The arrow connects a joint to the reference line. For standard welding symbols, the symbol below the reference line identifies the arrow side and a symbol above identifies the other side. A triangle indicates a fillet weld; groove shapes such as V or bevel indicate groove preparation. A circle at the arrow/reference-line junction means all-around; a flag means field weld. Read size, length, pitch, contour/finish, and tail notes together. The drawing symbol alone does not authorize a process or procedure.',
    exercise: 'Inspect the schematic weld callouts and match the symbol markers to their notes.',
    callouts: [
      { label: 'Arrow side', description: 'The fillet symbol below the reference line applies to the arrow side of the joint.' },
      { label: 'Other side', description: 'A symbol above the reference line applies to the opposite side.' },
      { label: 'Tail / flag', description: 'Tail notes add process or specification references; the flag indicates a field weld.' },
    ],
    question: 'What does a small circle at the arrow/reference-line junction indicate?',
    answers: [
      { text: 'Weld all around the joint', correct: true, feedback: 'Correct. The supplementary circle means the weld continues all around the joint.' },
      { text: 'A field weld', correct: false, feedback: 'A field-weld flag is a small flag at the junction; the circle means all-around.' },
      { text: 'A weld size of zero', correct: false, feedback: 'A circle here is a supplementary symbol, not a numeric size.' },
    ],
  },
  {
    id: 'views',
    level: 'Level 3 · Blueprint interpretation',
    title: 'Connect elevations, sections, and details',
    summary: 'Use view labels, cut markers, detail bubbles, scale, part marks, material, and revision data.',
    explanation: 'Plan, elevation, and section views describe the same assembly from different directions. A section cut marker shows where and which way to look; a detail callout enlarges a local feature and refers to its detail view. Scale helps visualize geometry but should not replace a written dimension. Before laying out parts, cross-check title block, part marks, material callouts, notes, and current revision.',
    exercise: 'Follow the A–A cut marker to the section and find the enlarged joint detail.',
    callouts: [
      { label: 'Elevation', description: 'Shows vertical heights and the stiffener profile above the plate.' },
      { label: 'A–A', description: 'The section cut line and viewing direction link the plan to the section view.' },
      { label: 'Detail B', description: 'An enlarged view clarifies the joint geometry; use written dimensions, not screen pixels.' },
    ],
    question: 'If a printed drawing is not at its stated scale, what should control your layout?',
    answers: [
      { text: 'Written dimensions and approved notes', correct: true, feedback: 'Correct. Scale is a visual aid; written dimensions and controlled notes govern.' },
      { text: 'A ruler measured against the printed view', correct: false, feedback: 'Print and screen scaling can change. Do not scale a view when written dimensions control.' },
      { text: 'The dimensions from a similar older assembly', correct: false, feedback: 'Similar parts can differ. Confirm the exact part mark and current revision.' },
    ],
  },
  {
    id: 'transfer',
    level: 'Level 2/5 · Measurement transfer and fit-up',
    title: 'Transfer the drawing to the assembly',
    summary: 'Establish the reference, mark, measure, and position before tacking.',
    explanation: 'Plan the layout from the drawing, establish and verify the datum, then mark and independently re-measure each location. Check part marks and orientation before positioning. Use clamps and shims to hold the part without forcing it; confirm dimensions and alignment before temporary tacks. If the part does not fit, diagnose the reference, dimension transfer, joint preparation, and distortion rather than hiding the mismatch.',
    exercise: 'Use the baseline and 125 mm offset to locate the stiffener; compare the marked position with the drawing.',
    callouts: [
      { label: '1 · Establish', description: 'Mark the baseline and confirm the datum before any offset.' },
      { label: '2 · Measure', description: 'Transfer the 125 mm offset from the specified datum with a suitable rule or tape.' },
      { label: '3 · Position', description: 'Align the stiffener to the mark and secure it with clamps before checking.' },
    ],
    question: 'The stiffener is 25 mm out when checked. What is the best first correction?',
    answers: [
      { text: 'Re-check the reference and transferred measurement, then reposition', correct: true, feedback: 'Correct. Find and correct the source of error before tacking or welding.' },
      { text: 'Force it into place with a tack weld', correct: false, feedback: 'A tack can lock in the error or create stress. Correct layout and fit before tack welding.' },
      { text: 'Change the drawing dimension to match the part', correct: false, feedback: 'Do not revise design requirements in the shop. Escalate drawing conflicts through the approved process.' },
    ],
  },
  {
    id: 'joint-prep',
    level: 'Level 4/6 · Steel measurement and joint preparation',
    title: 'Measure steel and prepare the joint',
    summary: 'Use suitable measuring tools and recognize preparation defects without substituting for a WPS.',
    explanation: 'Choose tools for the check: tape or steel rule for length, combination square for 90° layout, level for level/plumb checks, and gap gauge for root opening. Compare bevel angle, root face (land), and root gap with the specified drawing and approved welding procedure. Remove slag, burrs, mill scale, rust, oil, and other contamination as required. Grinding, chipping, cutting, or gouging must follow site safety requirements and the applicable procedure. Never assume a generic preparation is acceptable.',
    exercise: 'Inspect the joint cross-section and list every visible defect before fit-up.',
    callouts: [
      { label: 'Bevel angle', description: 'A bevel outside the specified angle changes groove geometry and access.' },
      { label: 'Root gap / land', description: 'A missing, excessive, or undersized root opening/face can impair penetration or fit.' },
      { label: 'Surface / edge', description: 'Contamination and burrs interfere with a clean, consistent joint.' },
    ],
    question: 'What should determine the target bevel, land, and root gap?',
    answers: [
      { text: 'The approved drawing and applicable welding procedure', correct: true, feedback: 'Correct. Confirm the current, applicable requirements; do not invent joint-prep values.' },
      { text: 'A convenient value from a different job', correct: false, feedback: 'Preparation varies by joint and procedure. Verify the requirements for this specific work.' },
      { text: 'The appearance that seems easiest to weld', correct: false, feedback: 'Visual preference is not a specification. Confirm values and raise unclear requirements before proceeding.' },
    ],
  },
];
