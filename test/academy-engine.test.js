import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

describe('academy challenge engine', () => {
  it('reports missing and irrelevant tools with specific coaching', () => {
    const result = checkToolSelection(
      ['tape', 'grinder'],
      chooseToolsChallenge.expectedTools,
      chooseToolsChallenge.coaching,
    );
    assert.equal(result.passed, false);
    assert.ok(result.feedback.some((message) => message.includes('combination square')));
    assert.ok(result.feedback.some((message) => message.includes('gap gauge')));
    assert.ok(result.feedback.some((message) => message.includes('not needed')));
  });

  it('identifies missed joint defects and false flags', () => {
    const result = checkJointDefects(['no-root-gap', 'invented'], jointDefects);
    assert.equal(result.passed, false);
    assert.equal(result.feedback.length, jointDefects.length);
  });

  it('uses inclusive tolerance and names the required datum on an offset error', () => {
    assert.equal(checkPosition(127, 125, 2, 'Baseline B').passed, true);
    const result = checkPosition(150, 125, 2, 'Baseline B');
    assert.equal(result.passed, false);
    assert.ok(result.feedback[0].includes('25 mm'));
    assert.ok(result.feedback[0].includes('Baseline B'));
  });

  it('checks every alignment value against its own tolerance', () => {
    const actual = Object.fromEntries(alignmentChallenge.measurements.map(({ id, target }) => [id, target]));
    actual.offset = 130;
    const result = checkAlignment(alignmentChallenge.measurements, actual);
    assert.equal(result.passed, false);
    assert.ok(result.feedback.some((message) => message.includes('Stiffener offset')));
  });

  it('enforces workflow order and gives a step-by-step score', () => {
    const skipped = recordWorkflowAction('fit', 0, workflowSteps);
    assert.equal(skipped.accepted, false);
    assert.equal(skipped.nextStep, 0);
    const first = recordWorkflowAction('read-drawing', 0, workflowSteps);
    assert.equal(first.accepted, true);
    assert.equal(first.score, 1);
  });
});
