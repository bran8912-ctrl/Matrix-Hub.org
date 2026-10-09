export const simulatorSource = 'matrix-hub-simulator';
export const simulatorVersion = 1;

export interface SimulatorPayloads {
  'tool-selected': { toolId: string };
  'inspect-complete': { component: 'base-plate'; findings?: string[] };
  'joint-prep-flagged': { defectIds: string[] };
  'reference-established': { datum: string; baseline: string };
  'part-positioned': { partId: string; offsetMm: number };
  'alignment-checked': { checks: { id: string; passed: boolean }[] };
  'correction-applied': { issue: string };
  'verification-complete': { summary: string };
  'challenge-complete': { score: number; verified: boolean };
}

export type SimulatorEvent = {
  [Type in keyof SimulatorPayloads]: {
    source: typeof simulatorSource;
    version: typeof simulatorVersion;
    type: Type;
    payload: SimulatorPayloads[Type];
  };
}[keyof SimulatorPayloads];

const shortString = (value: unknown, limit = 80): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;

const stringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 12 && value.every((item) => shortString(item, 120));

export function isSimulatorEvent(value: unknown): value is SimulatorEvent {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  if (
    message.source !== simulatorSource ||
    message.version !== simulatorVersion ||
    !message.payload ||
    typeof message.payload !== 'object'
  ) return false;
  const payload = message.payload as Record<string, unknown>;
  switch (message.type) {
    case 'tool-selected':
      return shortString(payload.toolId, 40);
    case 'inspect-complete':
      return payload.component === 'base-plate' &&
        (payload.findings === undefined || stringList(payload.findings));
    case 'joint-prep-flagged':
      return stringList(payload.defectIds);
    case 'reference-established':
      return shortString(payload.datum, 40) && shortString(payload.baseline, 40);
    case 'part-positioned':
      return shortString(payload.partId, 40) &&
        typeof payload.offsetMm === 'number' &&
        Number.isFinite(payload.offsetMm) &&
        Math.abs(payload.offsetMm) <= 100000;
    case 'alignment-checked':
      return Array.isArray(payload.checks) &&
        payload.checks.length > 0 &&
        payload.checks.length <= 10 &&
        payload.checks.every((check) =>
          check !== null &&
          typeof check === 'object' &&
          shortString((check as Record<string, unknown>).id, 40) &&
          typeof (check as Record<string, unknown>).passed === 'boolean',
        );
    case 'correction-applied':
      return shortString(payload.issue, 120);
    case 'verification-complete':
      return shortString(payload.summary, 160);
    case 'challenge-complete':
      return typeof payload.score === 'number' &&
        Number.isFinite(payload.score) &&
        payload.score >= 0 &&
        payload.score <= 100 &&
        typeof payload.verified === 'boolean';
    default:
      return false;
  }
}
