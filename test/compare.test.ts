import { describe, expect, it } from 'vitest';
import {
  compareResults,
  detectActivation,
  extractActivationMarkers,
  structuralSimilarity,
} from '../src/compare.js';
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

describe('extractActivationMarkers', () => {
  it('extracts backtick-quoted format strings that mention the skill name', () => {
    const s: Skill = {
      ...skill,
      body: 'Output a header: `csv-summarizer: <filename> (N rows × M columns)`.',
    };
    const markers = extractActivationMarkers(s);
    expect(markers).toContain('csv-summarizer:');
  });

  it('returns empty array when skill body has no name-prefixed markers', () => {
    const s: Skill = { ...skill, body: 'No format strings here, just prose.' };
    expect(extractActivationMarkers(s)).toEqual([]);
  });

  it('deduplicates markers', () => {
    const s: Skill = {
      ...skill,
      body: '`csv-summarizer: <a>` and later `csv-summarizer: <b>` and `csv-summarizer: <c>`',
    };
    expect(extractActivationMarkers(s)).toEqual(['csv-summarizer:']);
  });
});

describe('detectActivation', () => {
  it('activates when the skill name appears in output (no markers)', () => {
    expect(
      detectActivation(mkResult('claude-code', 'csv-summarizer: customers.csv (12 rows)'), skill)
    ).toBe(true);
  });

  it('activates when distinctive description keywords appear (no markers)', () => {
    expect(
      detectActivation(
        mkResult('codex', 'Here is the summary of your CSV with row counts and quality flags.'),
        skill
      )
    ).toBe(true);
  });

  it('does not activate on unrelated output (no markers)', () => {
    expect(
      detectActivation(mkResult('codex', 'I cannot help with that request.'), skill)
    ).toBe(false);
  });

  it('prefers markers when given: activates only on marker match', () => {
    const markers = ['csv-summarizer:'];
    expect(
      detectActivation(
        mkResult('codex', 'csv-summarizer: customers.csv (12 rows × 6 columns)'),
        skill,
        markers
      )
    ).toBe(true);
  });

  it('does NOT activate on keyword match alone when markers are required', () => {
    const markers = ['csv-summarizer:'];
    expect(
      detectActivation(
        mkResult('codex', 'Here is a generic summary about CSV data quality issues.'),
        skill,
        markers
      )
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
