import type { Comparison, PlatformId, RunResult, Skill, Verdict } from './types.js';

export interface CompareOptions {
  skill: Skill;
  baseline: PlatformId;
  useEmbeddings?: boolean;
  /** Outputs at or above this similarity are considered compatible. */
  similarityThreshold?: number;
}

const DEFAULT_THRESHOLD_STRUCTURAL = 0.6;
const DEFAULT_THRESHOLD_EMBEDDINGS = 0.85;

export async function compareResults(
  results: RunResult[],
  options: CompareOptions
): Promise<Comparison[]> {
  const baseline = results.find((r) => r.platform === options.baseline);
  if (!baseline) {
    throw new Error(`Baseline platform "${options.baseline}" not in results.`);
  }

  const useEmbeddings = Boolean(options.useEmbeddings && process.env.OPENAI_API_KEY);
  const threshold =
    options.similarityThreshold ??
    (useEmbeddings ? DEFAULT_THRESHOLD_EMBEDDINGS : DEFAULT_THRESHOLD_STRUCTURAL);

  const others = results.filter((r) => r.platform !== options.baseline);

  return Promise.all(
    others.map(async (r) => {
      let similarity: number | null = null;
      let verdict: Verdict;

      if (!r.invoked) {
        verdict = 'failed';
      } else if (!r.activated) {
        verdict = 'not-activated';
      } else if (!baseline.invoked || !baseline.activated) {
        verdict = 'compatible';
      } else {
        similarity = useEmbeddings
          ? await embeddingSimilarity(baseline.output, r.output).catch(() =>
              structuralSimilarity(baseline.output, r.output)
            )
          : structuralSimilarity(baseline.output, r.output);
        verdict = similarity >= threshold ? 'compatible' : 'diverged';
      }

      return {
        baseline: options.baseline,
        compared: r.platform,
        similarity,
        activationMatch: baseline.activated === r.activated,
        verdict,
      };
    })
  );
}

export function detectActivation(result: RunResult, skill: Skill): boolean {
  if (!result.invoked || !result.output) return false;
  const out = result.output.toLowerCase();
  if (out.includes(skill.name.toLowerCase())) return true;
  const keywords = uniqueKeywords(skill.description);
  if (keywords.length === 0) return false;
  const hits = keywords.filter((k) => out.includes(k)).length;
  const required = Math.min(3, Math.max(1, Math.floor(keywords.length / 4)));
  return hits >= required;
}

function uniqueKeywords(text: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'when',
    'into', 'over', 'use', 'using', 'used', 'your', 'have', 'will', 'when',
    'should', 'must', 'than', 'then',
  ]);
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 5 && !stop.has(w))
    )
  );
}

export function structuralSimilarity(a: string, b: string): number {
  const A = bigrams(tokens(a));
  const B = bigrams(tokens(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const x of A) if (B.has(x)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

function bigrams(toks: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]} ${toks[i + 1]}`);
  return set;
}

async function embeddingSimilarity(a: string, b: string): Promise<number> {
  const mod = await import('openai').catch(() => {
    throw new Error(
      'openai package is not installed. Install it with `npm i openai` to use --embeddings.'
    );
  });
  const OpenAI = (mod as unknown as { default: new () => { embeddings: { create: (req: { model: string; input: string[] }) => Promise<{ data: { embedding: number[] }[] }> } } }).default;
  const client = new OpenAI();
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: [trim(a), trim(b)],
  });
  const [v1, v2] = res.data.map((d) => d.embedding);
  return cosine(v1, v2);
}

function trim(s: string): string {
  return s.length > 8000 ? s.slice(0, 8000) : s;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}
