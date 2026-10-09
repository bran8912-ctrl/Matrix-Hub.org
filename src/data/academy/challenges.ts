export interface Tool {
  id: string;
  label: string;
}

export const toolOptions: Tool[] = [
  { id: 'tape', label: 'Tape measure' },
  { id: 'square', label: 'Combination square' },
  { id: 'level', label: 'Level' },
  { id: 'gap-gauge', label: 'Gap gauge' },
  { id: 'grinder', label: 'Grinder' },
  { id: 'chipping-hammer', label: 'Chipping hammer' },
  { id: 'clamps', label: 'Clamps' },
  { id: 'dividers', label: 'Dividers' },
];

export const chooseToolsChallenge = {
  id: 'measure-and-fit',
  task: 'Transfer a 125 mm offset from the baseline, check squareness and root gap, then hold the stiffener for a fit check.',
  expectedTools: ['tape', 'square', 'gap-gauge', 'clamps'],
  coaching: {
    tape: 'Use a tape or steel rule to transfer the stated linear offset.',
    square: 'A combination square checks the part’s 90° relationship to the plate.',
    'gap-gauge': 'A gap gauge checks the specified root opening.',
    clamps: 'Clamps hold parts in position while you verify fit-up.',
  },
};

export const jointDefects = [
  { id: 'bevel-angle', label: 'Bevel angle outside the specified value', feedback: 'The groove angle changes weld access and volume; compare it with the applicable drawing/WPS.' },
  { id: 'no-root-gap', label: 'No root gap', feedback: 'A closed root can prevent the specified root access or penetration; verify the required opening.' },
  { id: 'excessive-gap', label: 'Root gap is excessive', feedback: 'An oversized opening may exceed the procedure limits and can cause burn-through or excess fill.' },
  { id: 'missing-root-face', label: 'Root face/land is missing', feedback: 'Without the specified root face, the root geometry and weld behavior change.' },
  { id: 'contamination', label: 'Mill scale, rust, or oil remains on the surface', feedback: 'Contamination can cause weld discontinuities. Clean to the requirement before proceeding.' },
  { id: 'burrs', label: 'Burrs remain on the cut edge', feedback: 'Burrs disrupt contact and measurement. Remove them using the approved safe method.' },
];

export const positionChallenge = {
  id: 'stiffener-offset',
  reference: 'Baseline (datum B)',
  expectedMm: 125,
  toleranceMm: 2,
  wrongReferenceMm: 150,
};

export const alignmentChallenge = {
  id: 'fit-up-check',
  measurements: [
    { id: 'squareness', label: 'Squareness (°)', target: 90, tolerance: 1, unit: '°' },
    { id: 'plumb', label: 'Plumb deviation (mm)', target: 0, tolerance: 2, unit: ' mm' },
    { id: 'root-gap', label: 'Root gap (mm)', target: 3, tolerance: 1, unit: ' mm' },
    { id: 'offset', label: 'Stiffener offset (mm)', target: 125, tolerance: 2, unit: ' mm' },
    { id: 'mismatch', label: 'Edge mismatch (mm)', target: 0, tolerance: 2, unit: ' mm' },
  ],
};

export const workflowSteps = [
  { id: 'read-drawing', label: 'Read drawing', coaching: 'First identify the current drawing, part mark, dimensions, and weld notes.' },
  { id: 'establish-reference', label: 'Establish reference', coaching: 'Mark and verify the datum and baseline before transferring an offset.' },
  { id: 'measure', label: 'Measure', coaching: 'Transfer and independently check the stated measurements from their reference.' },
  { id: 'fit', label: 'Fit', coaching: 'Prepare and position the parts to the applicable drawing and procedure.' },
  { id: 'check', label: 'Check', coaching: 'Measure alignment, gap, squareness, plumb, and mismatch against tolerance.' },
  { id: 'correct', label: 'Correct', coaching: 'Correct the source of any out-of-tolerance condition before proceeding.' },
  { id: 'verify', label: 'Verify', coaching: 'Re-check the corrected fit and record the result before handoff.' },
];
