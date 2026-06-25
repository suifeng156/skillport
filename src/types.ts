export interface Skill {
  /** Absolute path to the skill directory. */
  path: string;
  /** Skill name from frontmatter (lowercase + hyphens, 1-64 chars). */
  name: string;
  /** Skill description from frontmatter (<= 1024 chars). */
  description: string;
  /** Markdown body of SKILL.md, with frontmatter stripped. */
  body: string;
  /** Raw SKILL.md contents. */
  raw: string;
}

export type PlatformId =
  | 'claude-code'
  | 'codex'
  | 'antigravity'
  | 'cursor'
  | 'windsurf';

export interface RunResult {
  platform: PlatformId;
  /** Did the CLI start and run to completion? */
  invoked: boolean;
  /** Did the agent appear to load and use the skill? */
  activated: boolean;
  /** Captured stdout. */
  output: string;
  durationMs: number;
  exitCode?: number;
  error?: string;
}

export type Verdict =
  | 'baseline'
  | 'compatible'
  | 'diverged'
  | 'not-activated'
  | 'failed';

export interface Comparison {
  baseline: PlatformId;
  compared: PlatformId;
  /** Cosine similarity (embeddings) or Jaccard (structural). null if not comparable. */
  similarity: number | null;
  /** Did baseline and compared agree on whether the skill activated? */
  activationMatch: boolean;
  verdict: Verdict;
}

export interface Report {
  skill: Skill;
  task: string;
  baseline: PlatformId;
  results: RunResult[];
  comparisons: Comparison[];
  generatedAt: string;
}

export interface RunOptions {
  cwd: string;
  timeoutMs: number;
  env?: Record<string, string>;
}

// ─── bench ────────────────────────────────────────────────────────────

export interface BenchTask {
  id: string;
  description?: string;
  task: string;
  /** Strings that MUST appear in the agent's output for the task to count as passed. */
  expectedMarkers?: string[];
  /** Strings that MUST NOT appear in the agent's output. */
  unexpectedMarkers?: string[];
  /** Per-task timeout override (ms). Falls back to the bench default, then to 180000. */
  timeoutMs?: number;
}

export interface BenchThresholds {
  /** Minimum composite score [0..1] required per platform; below = exit 1. */
  composite?: number;
  /** Minimum activation rate [0..1] required per platform. */
  activationRate?: number;
  /** Minimum task pass rate [0..1] required per platform. */
  taskPassRate?: number;
}

export interface Bench {
  /** Absolute path to the loaded bench file (for error messages). */
  path: string;
  name: string;
  description?: string;
  /** Absolute path to the skill directory. */
  skillPath: string;
  /** If set, restricts the bench to these platforms (else CLI default). */
  platforms?: PlatformId[];
  /** Platform used as the comparison baseline. */
  baseline?: PlatformId;
  defaultTimeoutMs?: number;
  thresholds?: BenchThresholds;
  tasks: BenchTask[];
}

export interface BenchTaskResult {
  taskId: string;
  platform: PlatformId;
  invoked: boolean;
  activated: boolean;
  output: string;
  durationMs: number;
  expectedMarkersHit: number;
  expectedMarkersTotal: number;
  unexpectedMarkersHit: number;
  unexpectedMarkersTotal: number;
  /** True when expected markers fully hit AND zero unexpected markers hit. */
  passed: boolean;
  /** Cosine/Jaccard similarity vs baseline run of the same task. null when not comparable. */
  similarityToBaseline: number | null;
  error?: string;
}

export interface PlatformScore {
  platform: PlatformId;
  taskCount: number;
  activationRate: number;
  taskPassRate: number;
  markerCoverage: number;
  meanSimilarity: number | null;
  /** (activationRate + taskPassRate) / 2 — marker coverage and similarity reported separately. */
  composite: number;
}

export interface BenchReport {
  bench: Bench;
  skill: Skill;
  baseline: PlatformId;
  taskResults: BenchTaskResult[];
  platformScores: PlatformScore[];
  generatedAt: string;
}
