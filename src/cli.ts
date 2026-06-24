#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getAdapters, listSupportedPlatforms } from './adapters/index.js';
import { compareResults } from './compare.js';
import { renderHtmlReport } from './html-report.js';
import { renderReport } from './report.js';
import { runAcrossPlatforms } from './runner.js';
import { loadSkill } from './skill-loader.js';
import type { PlatformId, Report } from './types.js';

const program = new Command();

program
  .name('skillport')
  .description('Cross-platform compatibility tester for Agent Skills.')
  .version('0.2.0');

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

function fail(msg: string): never {
  console.error(chalk.red(`error: ${msg}`));
  process.exit(2);
}
