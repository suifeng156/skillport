# skillport

> Run one `SKILL.md` on multiple agent platforms — see where they diverge.

[![CI](https://github.com/suifeng156/skillport/actions/workflows/ci.yml/badge.svg)](https://github.com/suifeng156/skillport/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@lbf-fff/skillport.svg)](https://www.npmjs.com/package/@lbf-fff/skillport)
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
  │ cursor      │     ✓     │    0.84    │ compatible          │   5.3s   │
  │ antigravity │     ✗     │     —      │ skill not activated │   3.8s   │
  └─────────────┴───────────┴────────────┴─────────────────────┴──────────┘

  ⚠ 1 platform(s) diverged. Run with --verbose to inspect outputs.
```

Exit code is `0` when every platform passes, `1` when any diverges — drop it into CI to gate skill releases.

## Why this exists

A skill is "portable" if every agent that supports the spec loads it the same way and follows its instructions the same way. The spec [defines the file format](https://agentskills.io); it does **not** define agent behavior. When you ship a skill into [awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) or to a [marketplace](https://claudemarketplaces.com), you ship a promise of cross-platform behavior that you have not actually verified.

`skillport` is what you run before you make that promise.

## Install

```bash
npm install -g @lbf-fff/skillport
```

(The CLI command is still `skillport` — only the install path is scoped.)

You also need the platform CLIs you want to test against:

| Platform                | CLI to install                                                                    | Adapter status |
| ----------------------- | --------------------------------------------------------------------------------- | -------------- |
| Claude Code             | [code.claude.com/docs](https://code.claude.com/docs/en/quickstart)                | ✓ supported    |
| OpenAI Codex            | `npm i -g @openai/codex`                                                          | ✓ supported    |
| Cursor Agent            | [cursor.com/docs/cli](https://cursor.com/docs/cli/using)                          | ✓ supported    |
| Google Antigravity      | `curl -fsSL https://antigravity.google/cli/install.sh \| bash`                    | ✓ supported    |

All four adapters install your skill into the platform's project-scoped skills directory (`.claude/skills/`, `.codex/skills/`, `.cursor/skills/`, `.agents/skills/` respectively), inside a per-run temp sandbox — your real `~/.{platform}/` is never touched.

**Why no Gemini CLI?** Google [deprecated Gemini CLI on 2026-06-18](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) in favor of Antigravity CLI. Use the `antigravity` adapter instead — `agy` inherits SKILL.md support and supports project-scoped skills via `.agents/skills/`.

**Why no Windsurf?** Codeium's Windsurf was acquired by Cognition and [rebranded to Devin Desktop on 2026-06-02](https://devin.ai/blog/windsurf-2-0/). The legacy Cascade agent is end-of-life 2026-07-01. The replacement CLI surface is still in flux — adapter is deferred until Devin Desktop publishes a stable non-interactive task mode.

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

# 4. Generate a shareable HTML report
skillport test ./my-skill \
  --task "..." \
  --html ./report.html
```

## How it works

For each platform `skillport`:

1. **Sandboxes**. It creates a fresh tempdir per platform — your real `~/.claude` and `~/.codex` are not touched.
2. **Installs** your skill into the platform's project-scoped skills directory inside that sandbox (e.g. `.claude/skills/<name>/`, `.codex/skills/<name>/`).
3. **Invokes** the platform's non-interactive CLI mode with your task description.
4. **Captures** stdout and timing.
5. **Detects activation** — when your skill body contains a backtick-quoted output marker that names the skill (e.g. `` `csv-summarizer: <filename> ...` ``), skillport requires that exact literal in the output to count as activated. This catches the "agent answered something plausible but never loaded the skill" failure mode. If no such marker exists, falls back to a skill-name + description-keyword heuristic.
6. **Compares** each non-baseline output to the baseline using Jaccard bigram similarity by default, or OpenAI embeddings via `--embeddings`.
7. **Renders** a colored CLI table by default. Pass `--html report.html` for a self-contained HTML report (dark/light auto, collapsible outputs) or `--json` for machine-readable output.

The whole thing is parallel across platforms.

## Configuration

Override platform CLI binaries when they're not on `PATH` under standard names:

```bash
SKILLPORT_CLAUDE_CODE_BIN=/opt/anthropic/claude
SKILLPORT_CODEX_BIN=/opt/openai/codex
SKILLPORT_CURSOR_BIN=/opt/cursor/cursor-agent
SKILLPORT_ANTIGRAVITY_BIN=/opt/google/agy
```

Override CLI invocation flags (each platform CLI evolves on its own schedule — if a release changes the subcommand, just set the env var instead of waiting for a skillport patch):

```bash
SKILLPORT_CODEX_ARGS="run --no-stream"      # instead of the default 'exec'
SKILLPORT_CURSOR_ARGS="--print"             # instead of the default '-p'
SKILLPORT_ANTIGRAVITY_ARGS="-p --dangerously-skip-permissions"
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

- v0.1 — Claude Code + Codex adapters; structural and embedding similarity; CI-friendly exit codes ✅
- v0.2 — Cursor + Antigravity adapters; marker-based activation detection; HTML report ✅
- v0.3 — `skillport bench`: run a battery of tasks per skill and emit a compatibility scorecard
- v0.4 — Hosted leaderboard for popular skills (`skillport.dev/leaderboard`)
- v?.? — Devin Desktop (ex-Windsurf) adapter once its non-interactive CLI mode stabilizes

## Library usage

If you'd rather call it from your own tooling:

```ts
import { loadSkill, runAcrossPlatforms, compareResults, getAdapters } from '@lbf-fff/skillport';

const skill = await loadSkill('./my-skill');
const adapters = getAdapters(['claude-code', 'codex']);
const results = await runAcrossPlatforms(skill, 'do the thing', adapters, { timeoutMs: 120000 });
const comparisons = await compareResults(results, { skill, baseline: 'claude-code' });
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The shortest path to having a real impact: file an issue with a skill that behaves differently across platforms and the exact task that exposes it — those reports are the most useful signal we have.

## License

MIT
