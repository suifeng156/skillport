# skillport

> Run one `SKILL.md` on multiple agent platforms — see where they diverge.

[![CI](https://github.com/suifeng156/skillport/actions/workflows/ci.yml/badge.svg)](https://github.com/suifeng156/skillport/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/skillport.svg)](https://www.npmjs.com/package/skillport)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The [Agent Skills](https://agentskills.io) standard is open. Your `SKILL.md` is portable to 30+ agent products in theory. In practice nobody tests whether it actually behaves the same way on Claude Code, Codex, Cursor, Antigravity — and the answer is often "no."

`skillport` is a CLI that runs one skill on multiple agent platforms with the same task and tells you, with numbers, where they diverge.

```
$ skillport test ./examples/csv-summarizer \
    --task "Summarize customers.csv and flag any data quality issues."

  Skill: csv-summarizer (/Users/you/examples/csv-summarizer)
  Task:  "Summarize customers.csv and flag any data quality issues."

  ┌─────────────┬───────────┬────────────┬─────────────────────┬──────────┐
  │ Platform    │ Activated │ Similarity │ Verdict             │ Duration │
  ├─────────────┼───────────┼────────────┼─────────────────────┼──────────┤
  │ claude-code │     ✓     │     —      │ baseline            │   4.2s   │
  │ codex       │     ✓     │    0.91    │ compatible          │   6.1s   │
  └─────────────┴───────────┴────────────┴─────────────────────┴──────────┘

  ✓ All platforms compatible.
```

Exit code is `0` when every platform passes, `1` when any diverges — drop it into CI to gate skill releases.

## Why this exists

A skill is "portable" if every agent that supports the spec loads it the same way and follows its instructions the same way. The spec [defines the file format](https://agentskills.io); it does **not** define agent behavior. When you ship a skill into [awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) or to a [marketplace](https://claudemarketplaces.com), you ship a promise of cross-platform behavior that you have not actually verified.

`skillport` is what you run before you make that promise.

## Install

```bash
npm install -g skillport
```

You also need the platform CLIs you want to test against:

| Platform                | CLI to install                                                                   | Adapter status |
| ----------------------- | -------------------------------------------------------------------------------- | -------------- |
| Claude Code             | [code.claude.com/docs](https://code.claude.com/docs/en/quickstart)               | ✓ supported    |
| OpenAI Codex            | `npm i -g @openai/codex`                                                         | ✓ supported    |
| Google Antigravity CLI  | `curl -fsSL https://antigravity.google/cli/install.sh \| bash`                   | 🚧 v0.2        |
| Cursor                  | Cursor Agent CLI                                                                 | 🚧 v0.2        |
| Windsurf                | Windsurf CLI                                                                     | 🚧 v0.2        |

**Why no Gemini CLI?** Google [deprecated Gemini CLI on 2026-06-18](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) in favor of Antigravity CLI. Antigravity inherits SKILL.md support, but its skill-loading paths (`~/.gemini/antigravity-cli/skills/`) are global-only — skillport's per-run sandbox model needs project-scoped support to avoid clobbering your real skills. Adapter is deferred to v0.2 once a project-scoped path is verified.

Cursor and Windsurf are IDE-first and don't have stable headless invocation in v0.1 — adapters are planned for v0.2 once their non-interactive modes stabilize.

## Quickstart

```bash
# 1. Check which platforms are installed and ready
skillport platforms

# 2. Run the bundled example
skillport test ./examples/csv-summarizer \
  --task "$(cat ./examples/csv-summarizer/task.txt)"

# 3. Run on your own skill, JSON output for CI
skillport test ./my-skill \
  --task "Whatever your skill expects" \
  --json > skillport-report.json
```

## How it works

For each platform `skillport`:

1. **Sandboxes**. It creates a fresh tempdir per platform — your real `~/.claude` and `~/.codex` are not touched.
2. **Installs** your skill into the platform's project-scoped skills directory inside that sandbox (e.g. `.claude/skills/<name>/`, `.codex/skills/<name>/`).
3. **Invokes** the platform's non-interactive CLI mode with your task description.
4. **Captures** stdout and timing.
5. **Detects activation** — does the output show signs the skill was actually loaded? (skill name reference, distinctive keywords from the skill description)
6. **Compares** each non-baseline output to the baseline using Jaccard bigram similarity by default, or OpenAI embeddings via `--embeddings`.

The whole thing is parallel across platforms.

## Configuration

Override platform CLI binaries when they're not on `PATH` under standard names:

```bash
SKILLPORT_CLAUDE_CODE_BIN=/opt/anthropic/claude
SKILLPORT_CODEX_BIN=/opt/openai/codex
```

Override CLI invocation flags (e.g. for new Codex versions that change the subcommand):

```bash
SKILLPORT_CODEX_ARGS="run --no-stream"     # instead of the default 'exec'
```

For semantic similarity instead of structural:

```bash
export OPENAI_API_KEY=sk-…
skillport test ./my-skill --task "…" --embeddings
```

Tune the compatibility threshold:

```bash
skillport test ./my-skill --task "…" --threshold 0.75
```

## Roadmap

- v0.1 — Claude Code, Codex; structural and embedding similarity; CI-friendly exit codes ✅
- v0.2 — Antigravity CLI, Cursor, Windsurf adapters; richer activation heuristics; HTML report
- v0.3 — `skillport bench` — run a battery of tasks per skill and emit a compatibility scorecard
- v0.4 — Hosted leaderboard for popular skills (`skillport.dev/leaderboard`)

## Library usage

If you'd rather call it from your own tooling:

```ts
import { loadSkill, runAcrossPlatforms, compareResults, getAdapters } from 'skillport';

const skill = await loadSkill('./my-skill');
const adapters = getAdapters(['claude-code', 'codex']);
const results = await runAcrossPlatforms(skill, 'do the thing', adapters, { timeoutMs: 120000 });
const comparisons = await compareResults(results, { skill, baseline: 'claude-code' });
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The shortest path to having a real impact: file an issue with a skill that behaves differently across platforms and the exact task that exposes it — those reports are the most useful signal we have.

## License

MIT
