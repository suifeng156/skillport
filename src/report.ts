import chalk from 'chalk';
import Table from 'cli-table3';
import type { Report, Verdict } from './types.js';

export function renderReport(report: Report): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(
    `  ${chalk.bold('Skill:')} ${chalk.cyan(report.skill.name)} ${chalk.gray(`(${report.skill.path})`)}`
  );
  lines.push(`  ${chalk.bold('Task:')}  ${chalk.gray('"' + truncate(report.task, 80) + '"')}`);
  lines.push('');

  const table = new Table({
    head: ['Platform', 'Activated', 'Similarity', 'Verdict', 'Duration'].map((h) =>
      chalk.bold(h)
    ),
    style: { head: [], border: ['gray'] },
  });

  for (const r of report.results) {
    const cmp = report.comparisons.find((c) => c.compared === r.platform);
    const isBaseline = r.platform === report.baseline;
    const activated = !r.invoked
      ? chalk.red('—')
      : r.activated
        ? chalk.green('✓')
        : chalk.red('✗');
    const sim = isBaseline
      ? chalk.gray('—')
      : cmp?.similarity == null
        ? chalk.gray('—')
        : colorSim(cmp.similarity);
    const verdict = isBaseline
      ? chalk.gray('baseline')
      : cmp
        ? colorVerdict(cmp.verdict, r.error)
        : chalk.gray('—');
    const duration = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : '—';
    table.push([r.platform, activated, sim, verdict, chalk.gray(duration)]);
  }

  for (const row of table.toString().split('\n')) {
    lines.push('  ' + row);
  }
  lines.push('');

  const failing = report.comparisons.filter(
    (c) => c.verdict !== 'compatible' && c.verdict !== 'baseline'
  );
  if (failing.length === 0) {
    lines.push(chalk.green('  ✓ All platforms compatible.'));
  } else {
    lines.push(
      chalk.yellow(
        `  ⚠ ${failing.length} platform(s) diverged. Run with ${chalk.bold('--verbose')} to inspect outputs.`
      )
    );
  }
  lines.push('');
  return lines.join('\n');
}

function colorSim(v: number): string {
  const formatted = v.toFixed(2);
  if (v >= 0.85) return chalk.green(formatted);
  if (v >= 0.6) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

function colorVerdict(v: Verdict, error?: string): string {
  switch (v) {
    case 'baseline':
      return chalk.gray('baseline');
    case 'compatible':
      return chalk.green('compatible');
    case 'diverged':
      return chalk.yellow('diverged');
    case 'not-activated':
      return chalk.red('skill not activated');
    case 'failed':
      return chalk.red(`failed: ${truncate(error ?? 'unknown', 24)}`);
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
