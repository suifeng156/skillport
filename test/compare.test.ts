import { describe, expect, it } from 'vitest';
import { compareResults, detectActivation, structuralSimilarity } from '../src/compare.js';
import type { RunResult, Skill } from '../src/types.js';

const skill: Skill = {
  path: '/tmp/x',
  name: 'csv-summarizer',
  description: 'Summarize CSV files with row counts and data quality issues.',
  body: '',
  raw: '',
};

const mkResult = (
  platform: RunResult['platform'],
  output: string,
  overrides: Partial<RunResult> = {}
): RunResult => ({
  platform,
  invoked: true,
  activated: false,
  output,
  durationMs: 1000,
  ...overrides,
});

describe('structuralSimilarity', () => {
  it('returns 1 for identical text', () => {
    expect(structuralSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for fully disjoint text', () => {
    expect(structuralSimilarity('abc def ghi', 'xyz uvw rst')).toBe(0);
  });

  it('returns intermediate score for partial overlap', () => {
    const s = structuralSimilarity(
      'the quick brown fox jumps',
      'the quick brown dog leaps'
    );
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

describe('detectActivation', () => {
  it('activates when the skill name appears in output', () => {
    expect(
      detectActivation(mkResult('claude-code', 'csv-summarizer: customers.csv (12 rows)'), skill)
    ).toBe(true);
  });

  it('activates when distinctive description keywords appear', () => {
    expect(
      detectActivation(
        mkResult('codex', 'Here is the summary of your CSV with row counts and quality flags.'),
        skill
      )
    ).toBe(true);
  });

  it('does not activate on unrelated output', () => {
    expect(
      detectActivation(mkResult('codex', 'I cannot help with that request.'), skill)
    ).toBe(false);
  });
});

describe('compareResults', () => {
  it('marks baseline + compatible runs', async () => {
    const results: RunResult[] = [
      mkResult('claude-code', 'csv-summarizer: 12 rows × 6 columns', { activated: true }),
      mkResult('codex', 'csv-summarizer: 12 rows × 6 columns', { activated: true }),
    ];
    const cmp = await compareResults(results, { skill, baseline: 'claude-code' });
    expect(cmp).toHaveLength(1);
    expect(cmp[0].verdict).toBe('compatible');
  });

  it('flags not-activated when skill did not load', async () => {
    const results: RunResult[] = [
      mkResult('claude-code', 'csv-summarizer: 12 rows', { activated: true }),
      mkResult('codex', 'I cannot do that.', { activated: false }),
    ];
    const cmp = await compareResults(results, { skill, baseline: 'claude-code' });
    expect(cmp[0].verdict).toBe('not-activated');
  });

  it('flags failed when run did not invoke', async () => {
    const results: RunResult[] = [
      mkResult('claude-code', 'csv-summarizer: ok', { activated: true }),
      mkResult('codex', '', { invoked: false, activated: false, error: 'no cli' }),
    ];
    const cmp = await compareResults(results, { skill, baseline: 'claude-code' });
    expect(cmp[0].verdict).toBe('failed');
  });
});
