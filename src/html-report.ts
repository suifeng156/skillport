import type { Comparison, Report, RunResult, Verdict } from './types.js';

export function renderHtmlReport(report: Report): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>skillport: ${escapeHtml(report.skill.name)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${HTML_CSS}
</head>
<body>
<main>
  <header>
    <h1><span class="brand">skillport</span> · <span class="skill">${escapeHtml(report.skill.name)}</span></h1>
    <p class="task">${escapeHtml(report.task)}</p>
    <p class="meta">
      Baseline: <code>${escapeHtml(report.baseline)}</code>
      · Generated: <time>${escapeHtml(report.generatedAt)}</time>
      · Skill: <code>${escapeHtml(report.skill.path)}</code>
    </p>
  </header>
  <table class="results">
    <thead>
      <tr><th>Platform</th><th>Activated</th><th>Similarity</th><th>Verdict</th><th>Duration</th></tr>
    </thead>
    <tbody>
      ${report.results.map((r) => renderRow(r, report)).join('')}
    </tbody>
  </table>
  ${renderSummary(report)}
  <section class="outputs">
    <h2>Outputs</h2>
    ${report.results.map(renderOutput).join('')}
  </section>
</main>
</body>
</html>
`;
}

function renderRow(r: RunResult, report: Report): string {
  const isBaseline = r.platform === report.baseline;
  const cmp = report.comparisons.find((c) => c.compared === r.platform);
  const activated = !r.invoked
    ? '<span class="dim">—</span>'
    : r.activated
      ? '<span class="ok">✓</span>'
      : '<span class="bad">✗</span>';
  const sim = isBaseline
    ? '<span class="dim">—</span>'
    : cmp?.similarity == null
      ? '<span class="dim">—</span>'
      : `<span class="${simClass(cmp.similarity)}">${cmp.similarity.toFixed(2)}</span>`;
  const verdict = isBaseline
    ? '<span class="dim">baseline</span>'
    : cmp
      ? `<span class="${verdictClass(cmp.verdict)}">${escapeHtml(cmp.verdict)}</span>`
      : '<span class="dim">—</span>';
  const duration = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : '—';
  return `<tr>
    <td><code>${escapeHtml(r.platform)}</code></td>
    <td>${activated}</td>
    <td>${sim}</td>
    <td>${verdict}</td>
    <td class="dim">${escapeHtml(duration)}</td>
  </tr>`;
}

function renderSummary(report: Report): string {
  const failing = report.comparisons.filter((c) => c.verdict !== 'compatible');
  if (failing.length === 0) {
    return '<p class="summary ok">✓ All platforms compatible.</p>';
  }
  return `<p class="summary warn">⚠ ${failing.length} platform(s) diverged. See per-platform outputs below.</p>`;
}

function renderOutput(r: RunResult): string {
  const body = r.error
    ? `<pre class="err">${escapeHtml(r.error)}</pre>`
    : r.output
      ? `<pre>${escapeHtml(r.output)}</pre>`
      : '<p class="dim">(no output)</p>';
  return `<details>
    <summary><code>${escapeHtml(r.platform)}</code></summary>
    ${body}
  </details>`;
}

function simClass(v: number): string {
  if (v >= 0.85) return 'ok';
  if (v >= 0.6) return 'warn';
  return 'bad';
}

function verdictClass(v: Verdict): string {
  switch (v) {
    case 'compatible':
      return 'ok';
    case 'diverged':
      return 'warn';
    case 'not-activated':
    case 'failed':
      return 'bad';
    default:
      return 'dim';
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const HTML_CSS = `<style>
  :root {
    --bg: #0e1116;
    --panel: #161b22;
    --border: #2a313a;
    --fg: #e6edf3;
    --dim: #8b949e;
    --ok: #3fb950;
    --warn: #d29922;
    --bad: #f85149;
    --accent: #58a6ff;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #ffffff;
      --panel: #f6f8fa;
      --border: #d0d7de;
      --fg: #1f2328;
      --dim: #57606a;
      --ok: #1a7f37;
      --warn: #9a6700;
      --bad: #cf222e;
      --accent: #0969da;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", system-ui, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.55;
  }
  main { max-width: 920px; margin: 0 auto; padding: 32px 24px 64px; }
  header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  h1 { margin: 0 0 8px; font-weight: 600; font-size: 22px; }
  h1 .brand { color: var(--accent); }
  h1 .skill { color: var(--fg); }
  h2 { margin: 32px 0 12px; font-weight: 600; font-size: 16px; color: var(--dim); text-transform: uppercase; letter-spacing: .04em; }
  .task { margin: 0 0 6px; font-size: 15px; color: var(--fg); }
  .meta { margin: 0; font-size: 12px; color: var(--dim); }
  .meta code, table code, details summary code, .task code {
    background: var(--panel);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 90%;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  table.results { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
  table.results th, table.results td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  table.results th { color: var(--dim); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .ok { color: var(--ok); }
  .warn { color: var(--warn); }
  .bad { color: var(--bad); }
  .dim { color: var(--dim); }
  .summary { margin: 20px 0 0; padding: 12px 16px; border-radius: 6px; background: var(--panel); border: 1px solid var(--border); font-size: 14px; }
  .summary.ok { color: var(--ok); }
  .summary.warn { color: var(--warn); }
  section.outputs details {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  details summary {
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    font-size: 14px;
  }
  details[open] summary { border-bottom: 1px solid var(--border); }
  details pre {
    margin: 0;
    padding: 14px;
    overflow-x: auto;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  details pre.err { color: var(--bad); }
</style>`;
