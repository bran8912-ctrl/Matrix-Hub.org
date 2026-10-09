import { expect } from 'chai';
import {
  checkAlignment,
  checkJointDefects,
  checkPosition,
  checkToolSelection,
  recordWorkflowAction,
} from '../src/lib/academy/engine.ts';
import {
  alignmentChallenge,
  chooseToolsChallenge,
  jointDefects,
  workflowSteps,
} from '../src/data/academy/challenges.ts';
import { isSimulatorEvent, simulatorSource, simulatorVersion } from '../src/lib/academy/postMessage.ts';
import { mockSimulatorEvents } from '../src/lib/academy/mockSimulator.ts';

describe('academy challenge engine', () => {
  it('reports missing and irrelevant tools with specific coaching', () => {
    const result = checkToolSelection(
      ['tape', 'grinder'],
      chooseToolsChallenge.expectedTools,
      chooseToolsChallenge.coaching,
    );
    expect(result.passed).to.equal(false);
    expect(result.feedback.some((message) => message.includes('combination square'))).to.equal(true);
    expect(result.feedback.some((message) => message.includes('gap gauge'))).to.equal(true);
    expect(result.feedback.some((message) => message.includes('not needed'))).to.equal(true);
  });

  it('identifies missed joint defects and false flags', () => {
    const result = checkJointDefects(['no-root-gap', 'invented'], jointDefects);
    expect(result.passed).to.equal(false);
    expect(result.feedback).to.have.length(jointDefects.length);
  });

  it('uses inclusive tolerance and names the required datum on an offset error', () => {
    expect(checkPosition(127, 125, 2, 'Baseline B').passed).to.equal(true);
    const result = checkPosition(150, 125, 2, 'Baseline B');
    expect(result.passed).to.equal(false);
    expect(result.feedback[0]).to.include('25 mm');
    expect(result.feedback[0]).to.include('Baseline B');
  });

  it('checks every alignment value against its own tolerance', () => {
    const actual = Object.fromEntries(alignmentChallenge.measurements.map(({ id, target }) => [id, target]));
    actual.offset = 130;
    const result = checkAlignment(alignmentChallenge.measurements, actual);
    expect(result.passed).to.equal(false);
    expect(result.feedback.some((message) => message.includes('Stiffener offset'))).to.equal(true);
  });

  it('enforces workflow order and gives a step-by-step score', () => {
    const skipped = recordWorkflowAction('fit', 0, workflowSteps);
    expect(skipped.accepted).to.equal(false);
    expect(skipped.nextStep).to.equal(0);
    const first = recordWorkflowAction('read-drawing', 0, workflowSteps);
    expect(first.accepted).to.equal(true);
    expect(first.score).to.equal(1);
  });

  it('accepts only known, well-formed same-version simulator event shapes', () => {
    for (const event of mockSimulatorEvents) expect(isSimulatorEvent(event)).to.equal(true);
    expect(isSimulatorEvent({
      source: simulatorSource,
      version: simulatorVersion,
      type: 'part-positioned',
      payload: { partId: 'ST-01', offsetMm: Number.NaN },
    })).to.equal(false);
    expect(isSimulatorEvent({
      source: 'untrusted-frame',
      version: simulatorVersion,
      type: 'challenge-complete',
      payload: { score: 100, verified: true },
    })).to.equal(false);
    expect(isSimulatorEvent({
      source: simulatorSource,
      version: simulatorVersion + 1,
      type: 'challenge-complete',
      payload: { score: 100, verified: true },
    })).to.equal(false);
  });
});
