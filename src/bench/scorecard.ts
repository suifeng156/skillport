import type { BenchTaskResult, PlatformId, PlatformScore } from '../types.js';

/** Aggregate per-task results into one PlatformScore per platform. */
export function computeScorecard(
  results: BenchTaskResult[],
  baseline: PlatformId
): PlatformScore[] {
  const byPlatform = new Map<PlatformId, BenchTaskResult[]>();
  for (const r of results) {
    let list = byPlatform.get(r.platform);
    if (!list) {
      list = [];
      byPlatform.set(r.platform, list);
    }
    list.push(r);
  }

  const out: PlatformScore[] = [];
  for (const [platform, list] of byPlatform) {
    const taskCount = list.length;
    if (taskCount === 0) continue;

    const activated = list.filter((r) => r.activated).length;
    const passed = list.filter((r) => r.passed).length;

    const expectedTotal = list.reduce((a, r) => a + r.expectedMarkersTotal, 0);
    const expectedHit = list.reduce((a, r) => a + r.expectedMarkersHit, 0);
    const markerCoverage = expectedTotal === 0 ? 1 : expectedHit / expectedTotal;

    const simSamples = list
      .filter((r) => platform !== baseline && r.similarityToBaseline != null)
      .map((r) => r.similarityToBaseline as number);
    const meanSimilarity =
      simSamples.length === 0 ? null : simSamples.reduce((a, b) => a + b, 0) / simSamples.length;

    const activationRate = activated / taskCount;
    const taskPassRate = passed / taskCount;
    const composite = (activationRate + taskPassRate) / 2;

    out.push({
      platform,
      taskCount,
      activationRate,
      taskPassRate,
      markerCoverage,
      meanSimilarity,
      composite,
    });
  }

  // Baseline first, then others in input order.
  out.sort((a, b) => {
    if (a.platform === baseline) return -1;
    if (b.platform === baseline) return 1;
    return 0;
  });
  return out;
}
