import { describe, expect, it } from 'vitest';
import { renderHtmlReport } from '../src/html-report.js';
import type { Report } from '../src/types.js';

const baseReport: Report = {
  skill: {
    path: '/tmp/x',
    name: 'csv-summarizer',
    description: 'Summarize CSV files.',
    body: '',
    raw: '',
  },
  task: 'Summarize customers.csv',
  baseline: 'claude-code',
  results: [
    {
      platform: 'claude-code',
      invoked: true,
      activated: true,
      output: 'csv-summarizer: customers.csv (12 rows)',
      durationMs: 4200,
    },
    {
      platform: 'codex',
      invoked: true,
      activated: true,
      output: 'csv-summarizer: customers.csv (12 rows)',
      durationMs: 6100,
    },
  ],
  comparisons: [
    {
      baseline: 'claude-code',
      compared: 'codex',
      similarity: 0.91,
      activationMatch: true,
      verdict: 'compatible',
    },
  ],
  generatedAt: '2026-06-23T10:00:00.000Z',
};

describe('renderHtmlReport', () => {
  it('produces a self-contained HTML document', () => {
    const html = renderHtmlReport(baseReport);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>skillport: csv-summarizer</title>');
    expect(html).toContain('<style>');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('cdn.');
  });

  it('escapes user input to prevent HTML injection', () => {
    const naughty: Report = {
      ...baseReport,
      task: '<script>alert("xss")</script>',
      results: [
        {
          ...baseReport.results[0],
          output: '<img src=x onerror=alert(1)>',
        },
      ],
      comparisons: [],
    };
    const html = renderHtmlReport(naughty);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders all platform rows', () => {
    const html = renderHtmlReport(baseReport);
    expect(html).toContain('claude-code');
    expect(html).toContain('codex');
    expect(html).toContain('0.91');
  });

  it('shows the all-compatible summary when no divergence', () => {
    expect(renderHtmlReport(baseReport)).toContain('All platforms compatible');
  });
});
