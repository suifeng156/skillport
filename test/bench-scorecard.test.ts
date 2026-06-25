import { describe, expect, it } from 'vitest';
import { computeScorecard } from '../src/bench/scorecard.js';
import type { BenchTaskResult, PlatformId } from '../src/types.js';

const mk = (
  taskId: string,
  platform: PlatformId,
  overrides: Partial<BenchTaskResult> = {}
): BenchTaskResult => ({
  taskId,
  platform,
  invoked: true,
  activated: true,
  output: '',
  durationMs: 1000,
  expectedMarkersHit: 0,
  expectedMarkersTotal: 0,
  unexpectedMarkersHit: 0,
  unexpectedMarkersTotal: 0,
  passed: true,
  similarityToBaseline: null,
  ...overrides,
});

describe('computeScorecard', () => {
  it('returns one score per platform', () => {
    const results = [
      mk('t1', 'claude-code'),
      mk('t1', 'codex'),
      mk('t2', 'claude-code'),
      mk('t2', 'codex'),
    ];
    const s = computeScorecard(results, 'claude-code');
    expect(s).toHaveLength(2);
    expect(s.map((x) => x.platform)).toEqual(['claude-code', 'codex']);
  });

  it('puts baseline first', () => {
    const results = [
      mk('t1', 'codex'),
      mk('t1', 'cursor'),
      mk('t1', 'claude-code'),
    ];
    const s = computeScorecard(results, 'cursor');
    expect(s[0].platform).toBe('cursor');
  });

  it('computes activation and task pass rates', () => {
    const results = [
      mk('t1', 'codex', { activated: true, passed: true }),
      mk('t2', 'codex', { activated: true, passed: false }),
      mk('t3', 'codex', { activated: false, passed: false }),
      mk('t4', 'codex', { activated: false, passed: false }),
    ];
    const s = computeScorecard(results, 'codex');
    expect(s[0].activationRate).toBeCloseTo(0.5);
    expect(s[0].taskPassRate).toBeCloseTo(0.25);
    expect(s[0].composite).toBeCloseTo((0.5 + 0.25) / 2);
  });

  it('computes marker coverage across tasks', () => {
    const results = [
      mk('t1', 'codex', { expectedMarkersHit: 2, expectedMarkersTotal: 3 }),
      mk('t2', 'codex', { expectedMarkersHit: 1, expectedMarkersTotal: 1 }),
    ];
    const s = computeScorecard(results, 'codex');
    expect(s[0].markerCoverage).toBeCloseTo(3 / 4);
  });

  it('marker coverage = 1 when no markers expected anywhere', () => {
    const results = [mk('t1', 'codex')];
    expect(computeScorecard(results, 'codex')[0].markerCoverage).toBe(1);
  });

  it('mean similarity is null for baseline platform', () => {
    const results = [mk('t1', 'claude-code'), mk('t1', 'codex', { similarityToBaseline: 0.8 })];
    const s = computeScorecard(results, 'claude-code');
    const baseline = s.find((x) => x.platform === 'claude-code');
    const other = s.find((x) => x.platform === 'codex');
    expect(baseline?.meanSimilarity).toBeNull();
    expect(other?.meanSimilarity).toBeCloseTo(0.8);
  });

  it('mean similarity averages across comparable tasks', () => {
    const results = [
      mk('t1', 'codex', { similarityToBaseline: 0.9 }),
      mk('t2', 'codex', { similarityToBaseline: 0.7 }),
      mk('t3', 'codex', { similarityToBaseline: null }),
    ];
    const s = computeScorecard(results, 'claude-code');
    expect(s[0].meanSimilarity).toBeCloseTo(0.8);
  });
});
