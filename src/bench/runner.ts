import type { Adapter } from '../adapters/base.js';
import { extractActivationMarkers, structuralSimilarity } from '../compare.js';
import { runAcrossPlatforms } from '../runner.js';
import type {
  Bench,
  BenchTask,
  BenchTaskResult,
  PlatformId,
  RunResult,
  Skill,
} from '../types.js';

export interface RunBenchOptions {
  /** Falls back to bench.defaultTimeoutMs, then 180000. */
  defaultTimeoutMs?: number;
  /** Called with (taskIdx, totalTasks, task) before each task starts. */
  onTaskStart?: (idx: number, total: number, task: BenchTask) => void;
  /** Called with task results after each task completes. */
  onTaskDone?: (idx: number, total: number, task: BenchTask, results: BenchTaskResult[]) => void;
}

/**
 * Run a bench: each task in sequence, all platforms in parallel per task.
 * Tasks are run sequentially so output ordering is preserved and total
 * concurrency stays bounded (no thundering-herd against LLM APIs).
 */
export async function runBench(
  bench: Bench,
  skill: Skill,
  adapters: Adapter[],
  baseline: PlatformId,
  options: RunBenchOptions = {}
): Promise<BenchTaskResult[]> {
  const skillMarkers = extractActivationMarkers(skill);
  const fallbackTimeout = options.defaultTimeoutMs ?? bench.defaultTimeoutMs ?? 180_000;
  const all: BenchTaskResult[] = [];

  for (let i = 0; i < bench.tasks.length; i++) {
    const task = bench.tasks[i];
    options.onTaskStart?.(i, bench.tasks.length, task);
    const runResults = await runAcrossPlatforms(skill, task.task, adapters, {
      timeoutMs: task.timeoutMs ?? fallbackTimeout,
    });
    const baselineRun = runResults.find((r) => r.platform === baseline);
    const taskResults: BenchTaskResult[] = runResults.map((r) =>
      toTaskResult(task, r, baselineRun, skillMarkers)
    );
    options.onTaskDone?.(i, bench.tasks.length, task, taskResults);
    all.push(...taskResults);
  }

  return all;
}

function toTaskResult(
  task: BenchTask,
  run: RunResult,
  baseline: RunResult | undefined,
  skillMarkers: string[]
): BenchTaskResult {
  const expected = task.expectedMarkers ?? [];
  const unexpected = task.unexpectedMarkers ?? [];

  const expectedHit = run.invoked
    ? expected.filter((m) => run.output.includes(m)).length
    : 0;
  const unexpectedHit = run.invoked
    ? unexpected.filter((m) => run.output.includes(m)).length
    : 0;

  // A task passes when:
  //   - it ran without invocation error
  //   - all expected markers (if any) appeared
  //   - zero unexpected markers appeared
  //   - if no expected markers were declared, fall back to activation as the floor
  let passed: boolean;
  if (!run.invoked) {
    passed = false;
  } else if (expected.length > 0) {
    passed = expectedHit === expected.length && unexpectedHit === 0;
  } else {
    passed = run.activated && unexpectedHit === 0;
  }

  let similarity: number | null = null;
  if (baseline && baseline !== run && baseline.invoked && run.invoked) {
    similarity = structuralSimilarity(baseline.output, run.output);
  }

  return {
    taskId: task.id,
    platform: run.platform,
    invoked: run.invoked,
    activated: run.activated,
    output: run.output,
    durationMs: run.durationMs,
    expectedMarkersHit: expectedHit,
    expectedMarkersTotal: expected.length,
    unexpectedMarkersHit: unexpectedHit,
    unexpectedMarkersTotal: unexpected.length,
    passed,
    similarityToBaseline: similarity,
    error: run.error,
  };
}
