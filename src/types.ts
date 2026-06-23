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
  | 'gemini-cli'
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
