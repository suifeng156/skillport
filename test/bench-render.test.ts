import { describe, expect, it } from 'vitest';
import {
  renderBenchCli,
  renderBenchHtml,
  renderBenchMarkdown,
} from '../src/bench/render.js';
import type { BenchReport } from '../src/types.js';

const baseReport: BenchReport = {
  bench: {
    path: '/tmp/bench.yaml',
    name: 'demo-bench',
    description: 'A demo bench',
    skillPath: '/tmp/skill',
    tasks: [
      { id: 'alpha', task: 'do alpha', expectedMarkers: ['foo'] },
      { id: 'beta', task: 'do beta' },
    ],
  },
  skill: {
    path: '/tmp/skill',
    name: 'demo-skill',
    description: 'desc',
    body: '',
    raw: '',
  },
  baseline: 'claude-code',
  taskResults: [
    {
      taskId: 'alpha',
      platform: 'claude-code',
      invoked: true,
      activated: true,
      output: 'foo bar',
      durationMs: 100,
      expectedMarkersHit: 1,
      expectedMarkersTotal: 1,
      unexpectedMarkersHit: 0,
      unexpectedMarkersTotal: 0,
      passed: true,
      similarityToBaseline: null,
    },
    {
      taskId: 'alpha',
      platform: 'codex',
      invoked: true,
      activated: true,
      output: 'foo bar',
      durationMs: 120,
      expectedMarkersHit: 1,
      expectedMarkersTotal: 1,
      unexpectedMarkersHit: 0,
      unexpectedMarkersTotal: 0,
      passed: true,
      similarityToBaseline: 0.91,
    },
    {
      taskId: 'beta',
      platform: 'claude-code',
      invoked: true,
      activated: true,
      output: '',
      durationMs: 100,
      expectedMarkersHit: 0,
      expectedMarkersTotal: 0,
      unexpectedMarkersHit: 0,
      unexpectedMarkersTotal: 0,
      passed: true,
      similarityToBaseline: null,
    },
    {
      taskId: 'beta',
      platform: 'codex',
      invoked: true,
      activated: false,
      output: '',
      durationMs: 100,
      expectedMarkersHit: 0,
      expectedMarkersTotal: 0,
      unexpectedMarkersHit: 0,
      unexpectedMarkersTotal: 0,
      passed: false,
      similarityToBaseline: 0.4,
    },
  ],
  platformScores: [
    {
      platform: 'claude-code',
      taskCount: 2,
      activationRate: 1,
      taskPassRate: 1,
      markerCoverage: 1,
      meanSimilarity: null,
      composite: 1,
    },
    {
      platform: 'codex',
      taskCount: 2,
      activationRate: 0.5,
      taskPassRate: 0.5,
      markerCoverage: 1,
      meanSimilarity: 0.65,
      composite: 0.5,
    },
  ],
  generatedAt: '2026-06-25T10:00:00.000Z',
};

describe('renderBenchCli', () => {
  it('includes bench name, baseline, every task id, every platform', () => {
    const out = renderBenchCli(baseReport);
    expect(out).toContain('demo-bench');
    expect(out).toContain('claude-code');
    expect(out).toContain('codex');
    expect(out).toContain('alpha');
    expect(out).toContain('beta');
    expect(out).toContain('Scorecard');
  });
});

describe('renderBenchMarkdown', () => {
  it('emits a valid-looking markdown structure', () => {
    const md = renderBenchMarkdown(baseReport);
    expect(md).toContain('# skillport bench: demo-bench');
    expect(md).toContain('## Compatibility matrix');
    expect(md).toContain('## Scorecard');
    expect(md).toMatch(/\| alpha \| .* \| .* \|/);
    expect(md).toContain('| claude-code |');
    expect(md).toContain('| codex |');
  });
});

describe('renderBenchHtml', () => {
  it('produces a self-contained HTML document', () => {
    const html = renderBenchHtml(baseReport);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>skillport bench: demo-bench</title>');
    expect(html).toContain('<style>');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('cdn.');
  });

  it('escapes user input to prevent HTML injection', () => {
    const naughty: BenchReport = {
      ...baseReport,
      bench: {
        ...baseReport.bench,
        name: '<img src=x onerror=1>',
        description: '<script>alert(1)</script>',
      },
    };
    const html = renderBenchHtml(naughty);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;img');
  });
});
