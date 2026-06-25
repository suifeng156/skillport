import chalk from 'chalk';
import Table from 'cli-table3';
import { escapeHtml, HTML_CSS } from '../html-report.js';
import type {
  BenchReport,
  BenchTaskResult,
  PlatformId,
  PlatformScore,
} from '../types.js';

// ─── CLI ──────────────────────────────────────────────────────────────

export function renderBenchCli(report: BenchReport, verbose = false): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(
    `  ${chalk.bold('Bench:')} ${chalk.cyan(report.bench.name)}  ${chalk.gray(`(${report.bench.tasks.length} tasks × ${report.platformScores.length} platforms)`)}`
  );
  if (report.bench.description) {
    lines.push(`  ${chalk.gray(report.bench.description)}`);
  }
  lines.push(`  ${chalk.bold('Skill:')} ${chalk.cyan(report.skill.name)} ${chalk.gray(`(${report.skill.path})`)}`);
  lines.push(`  ${chalk.bold('Baseline:')} ${chalk.cyan(report.baseline)}`);
  lines.push('');

  // Matrix: rows are tasks, columns are platforms.
  const platforms = report.platformScores.map((s) => s.platform);
  const matrix = new Table({
    head: ['Task', ...platforms].map((h) => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
  });
  for (const task of report.bench.tasks) {
    const row: string[] = [task.id];
    for (const p of platforms) {
      row.push(formatMatrixCell(task.id, p, report));
    }
    matrix.push(row);
  }
  for (const line of matrix.toString().split('\n')) lines.push('  ' + line);
  lines.push('');

  // Scorecard
  const score = new Table({
    head: ['Platform', 'Activated', 'Marker Cov.', 'Task Pass', 'Mean Sim.', 'Composite'].map((h) =>
      chalk.bold(h)
    ),
    style: { head: [], border: ['gray'] },
  });
  for (const s of report.platformScores) {
    score.push([
      s.platform,
      colorPct(s.activationRate),
      colorPct(s.markerCoverage),
      colorPct(s.taskPassRate),
      s.meanSimilarity == null ? chalk.gray('—') : colorSim(s.meanSimilarity),
      chalk.bold(colorPct(s.composite)),
    ]);
  }
  lines.push(`  ${chalk.bold('Scorecard')}`);
  for (const line of score.toString().split('\n')) lines.push('  ' + line);
  lines.push('');

  if (verbose) {
    for (const task of report.bench.tasks) {
      lines.push(chalk.bold(chalk.cyan(`──── task: ${task.id} ────`)));
      if (task.description) lines.push(chalk.gray(task.description));
      for (const r of report.taskResults.filter((x) => x.taskId === task.id)) {
        lines.push('');
        lines.push(chalk.bold(`[${r.platform}]`) + ' ' + statusBadge(r));
        if (r.error) lines.push(chalk.red(r.error));
        lines.push(r.output || chalk.gray('(no output)'));
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatMatrixCell(taskId: string, platform: PlatformId, report: BenchReport): string {
  const r = report.taskResults.find((x) => x.taskId === taskId && x.platform === platform);
  if (!r) return chalk.gray('—');
  const isBaseline = platform === report.baseline;
  const pass = r.passed ? chalk.green('✓') : chalk.red('✗');
  const markers =
    r.expectedMarkersTotal > 0
      ? `${r.expectedMarkersHit}/${r.expectedMarkersTotal}`
      : r.activated
        ? 'act'
        : 'no-act';
  const sim = isBaseline
    ? chalk.gray('(B)')
    : r.similarityToBaseline == null
      ? chalk.gray('—')
      : colorSim(r.similarityToBaseline);
  return `${pass} ${chalk.dim(markers)} ${sim}`;
}

function statusBadge(r: BenchTaskResult): string {
  if (!r.invoked) return chalk.red('failed to invoke');
  if (r.passed) return chalk.green('passed');
  if (!r.activated) return chalk.red('skill not activated');
  return chalk.yellow(`partial: ${r.expectedMarkersHit}/${r.expectedMarkersTotal} markers`);
}

function colorPct(v: number): string {
  const s = `${Math.round(v * 100)}%`;
  if (v >= 0.8) return chalk.green(s);
  if (v >= 0.5) return chalk.yellow(s);
  return chalk.red(s);
}

function colorSim(v: number): string {
  const s = v.toFixed(2);
  if (v >= 0.85) return chalk.green(s);
  if (v >= 0.6) return chalk.yellow(s);
  return chalk.red(s);
}

// ─── Markdown ─────────────────────────────────────────────────────────

export function renderBenchMarkdown(report: BenchReport): string {
  const platforms = report.platformScores.map((s) => s.platform);
  const lines: string[] = [];
  lines.push(`# skillport bench: ${report.bench.name}`);
  lines.push('');
  if (report.bench.description) {
    lines.push(`> ${report.bench.description}`);
    lines.push('');
  }
  lines.push(
    `Skill: \`${report.skill.name}\` · Baseline: \`${report.baseline}\` · ${report.bench.tasks.length} tasks × ${platforms.length} platforms`
  );
  lines.push('');
  lines.push('## Compatibility matrix');
  lines.push('');
  lines.push('| Task | ' + platforms.join(' | ') + ' |');
  lines.push('|' + ['---'].concat(platforms.map(() => '---')).join('|') + '|');
  for (const task of report.bench.tasks) {
    const cells = platforms.map((p) => mdCell(task.id, p, report));
    lines.push(`| ${task.id} | ${cells.join(' | ')} |`);
  }
  lines.push('');
  lines.push('## Scorecard');
  lines.push('');
  lines.push('| Platform | Activated | Marker Cov. | Task Pass | Mean Sim. | Composite |');
  lines.push('|---|---|---|---|---|---|');
  for (const s of report.platformScores) {
    lines.push(
      `| ${s.platform} | ${pct(s.activationRate)} | ${pct(s.markerCoverage)} | ${pct(s.taskPassRate)} | ${s.meanSimilarity == null ? '—' : s.meanSimilarity.toFixed(2)} | **${pct(s.composite)}** |`
    );
  }
  lines.push('');
  lines.push(`<sub>Generated by skillport on ${report.generatedAt}</sub>`);
  return lines.join('\n');
}

function mdCell(taskId: string, platform: PlatformId, report: BenchReport): string {
  const r = report.taskResults.find((x) => x.taskId === taskId && x.platform === platform);
  if (!r) return '—';
  const pass = r.passed ? '✓' : '✗';
  const markers =
    r.expectedMarkersTotal > 0
      ? `${r.expectedMarkersHit}/${r.expectedMarkersTotal}`
      : r.activated
        ? 'act'
        : 'no-act';
  const sim =
    platform === report.baseline
      ? '(B)'
      : r.similarityToBaseline == null
        ? '—'
        : r.similarityToBaseline.toFixed(2);
  return `${pass} ${markers} ${sim}`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ─── HTML ─────────────────────────────────────────────────────────────

export function renderBenchHtml(report: BenchReport): string {
  const platforms = report.platformScores.map((s) => s.platform);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>skillport bench: ${escapeHtml(report.bench.name)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${HTML_CSS}
${EXTRA_CSS}
</head>
<body>
<main>
  <header>
    <h1><span class="brand">skillport bench</span> · <span class="skill">${escapeHtml(report.bench.name)}</span></h1>
    ${report.bench.description ? `<p class="task">${escapeHtml(report.bench.description)}</p>` : ''}
    <p class="meta">
      Skill: <code>${escapeHtml(report.skill.name)}</code>
      · Baseline: <code>${escapeHtml(report.baseline)}</code>
      · ${report.bench.tasks.length} tasks × ${platforms.length} platforms
      · Generated: <time>${escapeHtml(report.generatedAt)}</time>
    </p>
  </header>

  <h2>Compatibility matrix</h2>
  <table class="results matrix">
    <thead>
      <tr><th>Task</th>${platforms.map((p) => `<th><code>${escapeHtml(p)}</code></th>`).join('')}</tr>
    </thead>
    <tbody>
      ${report.bench.tasks
        .map((task) => {
          const cells = platforms
            .map((p) => `<td>${htmlCell(task.id, p, report)}</td>`)
            .join('');
          return `<tr><td><code>${escapeHtml(task.id)}</code></td>${cells}</tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <h2>Scorecard</h2>
  <table class="results">
    <thead>
      <tr>
        <th>Platform</th><th>Activated</th><th>Marker Cov.</th>
        <th>Task Pass</th><th>Mean Sim.</th><th>Composite</th>
      </tr>
    </thead>
    <tbody>
      ${report.platformScores
        .map(
          (s) => `<tr>
        <td><code>${escapeHtml(s.platform)}</code></td>
        <td>${pctHtml(s.activationRate)}</td>
        <td>${pctHtml(s.markerCoverage)}</td>
        <td>${pctHtml(s.taskPassRate)}</td>
        <td>${s.meanSimilarity == null ? '<span class="dim">—</span>' : simHtml(s.meanSimilarity)}</td>
        <td><strong>${pctHtml(s.composite)}</strong></td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <h2>Per-task outputs</h2>
  ${report.bench.tasks
    .map((task) => {
      const block = report.taskResults
        .filter((r) => r.taskId === task.id)
        .map(
          (r) => `<details>
        <summary><code>${escapeHtml(task.id)}</code> · <code>${escapeHtml(r.platform)}</code> · ${badgeHtml(r)}</summary>
        ${r.error ? `<pre class="err">${escapeHtml(r.error)}</pre>` : ''}
        <pre>${escapeHtml(r.output || '(no output)')}</pre>
      </details>`
        )
        .join('');
      return block;
    })
    .join('')}
</main>
</body>
</html>`;
}

function htmlCell(taskId: string, platform: PlatformId, report: BenchReport): string {
  const r = report.taskResults.find((x) => x.taskId === taskId && x.platform === platform);
  if (!r) return '<span class="dim">—</span>';
  const pass = r.passed ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>';
  const markers =
    r.expectedMarkersTotal > 0
      ? `<span class="dim">${r.expectedMarkersHit}/${r.expectedMarkersTotal}</span>`
      : r.activated
        ? '<span class="dim">act</span>'
        : '<span class="dim">no-act</span>';
  const sim =
    platform === report.baseline
      ? '<span class="dim">(B)</span>'
      : r.similarityToBaseline == null
        ? '<span class="dim">—</span>'
        : simHtml(r.similarityToBaseline);
  return `${pass} ${markers} ${sim}`;
}

function badgeHtml(r: BenchTaskResult): string {
  if (!r.invoked) return '<span class="bad">failed to invoke</span>';
  if (r.passed) return '<span class="ok">passed</span>';
  if (!r.activated) return '<span class="bad">skill not activated</span>';
  return `<span class="warn">partial: ${r.expectedMarkersHit}/${r.expectedMarkersTotal} markers</span>`;
}

function pctHtml(v: number): string {
  const s = `${Math.round(v * 100)}%`;
  const cls = v >= 0.8 ? 'ok' : v >= 0.5 ? 'warn' : 'bad';
  return `<span class="${cls}">${s}</span>`;
}

function simHtml(v: number): string {
  const cls = v >= 0.85 ? 'ok' : v >= 0.6 ? 'warn' : 'bad';
  return `<span class="${cls}">${v.toFixed(2)}</span>`;
}

const EXTRA_CSS = `<style>
  table.matrix td, table.matrix th { font-size: 13px; white-space: nowrap; }
  table.matrix td:first-child, table.matrix th:first-child { width: 40%; }
  table.matrix td:not(:first-child) { text-align: center; }
</style>`;
