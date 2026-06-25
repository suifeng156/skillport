#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getAdapters, listSupportedPlatforms } from './adapters/index.js';
import {
  computeScorecard,
  loadBench,
  renderBenchCli,
  renderBenchHtml,
  renderBenchMarkdown,
  runBench,
} from './bench/index.js';
import { compareResults } from './compare.js';
import { renderHtmlReport } from './html-report.js';
import { renderReport } from './report.js';
import { runAcrossPlatforms } from './runner.js';
import { loadSkill } from './skill-loader.js';
import type { BenchReport, PlatformId, Report } from './types.js';

const program = new Command();

program
  .name('skillport')
  .description('Cross-platform compatibility tester for Agent Skills.')
  .version('0.3.0');

program
  .command('test')
  .argument('<skill-dir>', 'path to skill directory containing SKILL.md')
  .requiredOption('-t, --task <description>', 'task to give the agent')
  .option(
    '-p, --platforms <list>',
    `comma-separated platforms (default: ${listSupportedPlatforms().join(',')})`,
    listSupportedPlatforms().join(',')
  )
  .option('-b, --baseline <platform>', 'baseline platform for comparison', 'claude-code')
  .option('--timeout <ms>', 'per-platform timeout in ms', '180000')
  .option('--embeddings', 'use OpenAI embeddings for similarity (needs OPENAI_API_KEY)', false)
  .option('--threshold <n>', 'compatibility threshold (0..1)', '')
  .option('--json', 'emit JSON instead of pretty report', false)
  .option('--html <path>', 'also write a standalone HTML report to <path>', '')
  .option('-v, --verbose', 'show full per-platform outputs', false)
  .action(async (skillDir: string, opts: TestOptions) => {
    try {
      const skill = await loadSkill(skillDir);
      const requested = opts.platforms.split(',').map((s) => s.trim()) as PlatformId[];
      const adapters = getAdapters(requested);
      if (!adapters.find((a) => a.id === opts.baseline)) {
        fail(`Baseline platform "${opts.baseline}" not in selected platforms.`);
      }

      const spinner = opts.json
        ? null
        : ora({
            text: `Running ${chalk.bold(skill.name)} on ${adapters.length} platform(s)…`,
            indent: 2,
          }).start();

      const results = await runAcrossPlatforms(skill, opts.task, adapters, {
        timeoutMs: Number(opts.timeout),
      });

      const threshold = opts.threshold ? Number(opts.threshold) : undefined;
      const comparisons = await compareResults(results, {
        skill,
        baseline: opts.baseline as PlatformId,
        useEmbeddings: opts.embeddings,
        similarityThreshold: threshold,
      });

      spinner?.stop();

      const report: Report = {
        skill,
        task: opts.task,
        baseline: opts.baseline as PlatformId,
        results,
        comparisons,
        generatedAt: new Date().toISOString(),
      };

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderReport(report));
        if (opts.verbose) {
          for (const r of results) {
            console.log(chalk.bold(chalk.cyan(`\n──── ${r.platform} ────\n`)));
            if (r.error) console.log(chalk.red(r.error) + '\n');
            console.log(r.output || chalk.gray('(no output)'));
          }
        }
      }

      if (opts.html) {
        const out = path.resolve(opts.html);
        await writeFile(out, renderHtmlReport(report), 'utf8');
        if (!opts.json) console.log(chalk.gray(`  HTML report written to ${out}\n`));
      }

      const diverged = comparisons.some((c) => c.verdict !== 'compatible');
      process.exit(diverged ? 1 : 0);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  });

program
  .command('bench')
  .description('run a multi-task bench across platforms and emit a compatibility scorecard')
  .argument('<bench-file>', 'path to a bench.yaml file')
  .option('-p, --platforms <list>', 'override platforms from bench file (comma-separated)', '')
  .option('-b, --baseline <platform>', 'override baseline from bench file', '')
  .option('--timeout <ms>', 'override per-task default timeout', '')
  .option('--threshold <n>', 'fail (exit 1) if any platform composite < n; overrides bench thresholds', '')
  .option('--json', 'emit JSON scorecard to stdout', false)
  .option('--html <path>', 'write a self-contained HTML scorecard to <path>', '')
  .option('--markdown <path>', 'write a Markdown scorecard to <path> (use \'-\' for stdout)', '')
  .option('-v, --verbose', 'include every per-task output in the CLI report', false)
  .action(async (benchFile: string, opts: BenchOptions) => {
    try {
      const bench = await loadBench(benchFile);
      const skill = await loadSkill(bench.skillPath);

      const platformIds = (
        opts.platforms
          ? (opts.platforms.split(',').map((s) => s.trim()) as PlatformId[])
          : (bench.platforms ?? listSupportedPlatforms())
      );
      const adapters = getAdapters(platformIds);
      const baseline = (opts.baseline || bench.baseline || platformIds[0]) as PlatformId;
      if (!adapters.find((a) => a.id === baseline)) {
        fail(`Baseline "${baseline}" not in selected platforms [${platformIds.join(', ')}].`);
      }

      const overrideTimeout = opts.timeout ? Number(opts.timeout) : undefined;
      const spinner = opts.json
        ? null
        : ora({
            text: `Running bench ${chalk.bold(bench.name)} — ${bench.tasks.length} tasks × ${adapters.length} platforms`,
            indent: 2,
          }).start();
      const startedAt = Date.now();
      let completedTasks = 0;

      const taskResults = await runBench(bench, skill, adapters, baseline, {
        defaultTimeoutMs: overrideTimeout,
        onTaskDone: (_, total) => {
          completedTasks++;
          if (spinner) {
            spinner.text = `Bench ${chalk.bold(bench.name)} · ${completedTasks}/${total} tasks done · ${((Date.now() - startedAt) / 1000).toFixed(1)}s elapsed`;
          }
        },
      });
      spinner?.stop();

      const platformScores = computeScorecard(taskResults, baseline);
      const report: BenchReport = {
        bench,
        skill,
        baseline,
        taskResults,
        platformScores,
        generatedAt: new Date().toISOString(),
      };

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderBenchCli(report, opts.verbose));
      }

      if (opts.html) {
        const out = path.resolve(opts.html);
        await writeFile(out, renderBenchHtml(report), 'utf8');
        if (!opts.json) console.log(chalk.gray(`  HTML scorecard written to ${out}`));
      }
      if (opts.markdown) {
        const md = renderBenchMarkdown(report);
        if (opts.markdown === '-') {
          console.log(md);
        } else {
          const out = path.resolve(opts.markdown);
          await writeFile(out, md, 'utf8');
          if (!opts.json) console.log(chalk.gray(`  Markdown scorecard written to ${out}`));
        }
      }

      const failed = shouldFail(report, opts.threshold);
      process.exit(failed ? 1 : 0);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  });

program
  .command('platforms')
  .description('list supported platforms and detect which CLIs are installed')
  .action(async () => {
    const adapters = getAdapters();
    console.log('');
    for (const a of adapters) {
      const installed = await a.isInstalled();
      const mark = installed ? chalk.green('✓') : chalk.red('✗');
      console.log(
        `  ${mark}  ${chalk.bold(a.displayName.padEnd(14))} ${chalk.gray(a.id)}` +
          (installed ? '' : chalk.gray(`   (not on PATH)`))
      );
    }
    console.log('');
  });

program.parseAsync().catch((err) => fail(err.message));

interface TestOptions {
  task: string;
  platforms: string;
  baseline: string;
  timeout: string;
  embeddings: boolean;
  threshold: string;
  json: boolean;
  html: string;
  verbose: boolean;
}

interface BenchOptions {
  platforms: string;
  baseline: string;
  timeout: string;
  threshold: string;
  json: boolean;
  html: string;
  markdown: string;
  verbose: boolean;
}

function shouldFail(report: BenchReport, cliThreshold: string): boolean {
  if (cliThreshold) {
    const t = Number(cliThreshold);
    return report.platformScores.some((p) => p.composite < t);
  }
  const t = report.bench.thresholds;
  if (!t) return false;
  return report.platformScores.some((p) => {
    if (t.composite != null && p.composite < t.composite) return true;
    if (t.activationRate != null && p.activationRate < t.activationRate) return true;
    if (t.taskPassRate != null && p.taskPassRate < t.taskPassRate) return true;
    return false;
  });
}

function fail(msg: string): never {
  console.error(chalk.red(`error: ${msg}`));
  process.exit(2);
}
