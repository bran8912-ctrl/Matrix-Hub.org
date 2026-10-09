import type { SimulatorEvent } from './postMessage';

const simulatorSource = 'matrix-hub-simulator';
const simulatorVersion = 1;

export const mockSimulatorEvents: SimulatorEvent[] = [
  { source: simulatorSource, version: simulatorVersion, type: 'tool-selected', payload: { toolId: 'tape' } },
  { source: simulatorSource, version: simulatorVersion, type: 'inspect-complete', payload: { component: 'base-plate', findings: ['Plate mark confirmed'] } },
  { source: simulatorSource, version: simulatorVersion, type: 'joint-prep-flagged', payload: { defectIds: ['burrs', 'contamination'] } },
  { source: simulatorSource, version: simulatorVersion, type: 'reference-established', payload: { datum: 'B', baseline: 'BL-1' } },
  { source: simulatorSource, version: simulatorVersion, type: 'part-positioned', payload: { partId: 'ST-01', offsetMm: 125 } },
  { source: simulatorSource, version: simulatorVersion, type: 'alignment-checked', payload: { checks: [{ id: 'squareness', passed: true }, { id: 'root-gap', passed: true }, { id: 'offset', passed: true }] } },
  { source: simulatorSource, version: simulatorVersion, type: 'correction-applied', payload: { issue: 'Initial offset corrected before tacking' } },
  { source: simulatorSource, version: simulatorVersion, type: 'verification-complete', payload: { summary: 'All simulated checks reviewed' } },
  { source: simulatorSource, version: simulatorVersion, type: 'challenge-complete', payload: { score: 100, verified: true } },
];
