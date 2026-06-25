# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] - 2026-06-25

### Added
- **`skillport bench <file>` subcommand.** Runs a YAML-declared battery of tasks across every selected platform and produces a per-platform scorecard.
- **Bench file format** (YAML) with `name`, `skill`, optional `platforms` / `baseline` / `default_timeout_ms` / `thresholds`, and a `tasks[]` array. Each task: `id` (unique kebab-case), `task` (the prompt), optional `expected_markers` (must appear in output), `unexpected_markers` (must not appear), `timeout_ms`. Schema validated at load with friendly errors.
- **Scoring.** Per platform: `activationRate`, `markerCoverage`, `taskPassRate`, `meanSimilarity` (vs baseline), and a `composite = (activationRate + taskPassRate) / 2`. Marker coverage is shown but excluded from composite to avoid being gamed by long marker lists with many partial hits.
- **Four output formats** for `bench`: pretty CLI table (default), `--json` (CI), `--markdown <path>` (PR comments, `-` for stdout), `--html <path>` (self-contained, reuses the `test` HTML stylesheet).
- **CI-shaped exit codes for bench.** `--threshold <n>` exits 1 when any platform's composite is below `<n>`; alternatively, set `thresholds.composite` (and / or `activation_rate`, `task_pass_rate`) in the bench file itself.
- **Bundled bench example.** `examples/csv-summarizer/bench.yaml` declares four tasks against the included `customers.csv`, exercising three real data-quality traps the skill should catch (missing email, malformed date, near-duplicate row).
- Library API: `loadBench`, `runBench`, `computeScorecard`, `renderBenchCli`, `renderBenchMarkdown`, `renderBenchHtml`.

### Changed
- Internal: `HTML_CSS` and `escapeHtml` are now exported from `html-report.ts` so the bench HTML renderer can reuse them without duplication.

### Tests
- 44 tests (was 23). New: `bench-loader.test.ts` (10), `bench-scorecard.test.ts` (7), `bench-render.test.ts` (4).

## [0.2.0] - 2026-06-24

### Added
- **Cursor adapter** (`cursor-agent -p <task>`, installs to `.cursor/skills/<name>/`). Project-scoped install confirmed against [Cursor docs](https://cursor.com/docs/cli/using).
- **Antigravity adapter** (`agy -p <task>`, installs to `.agents/skills/<name>/`). Project-scoped install via the `.agents/` portable convention, confirmed against [Google docs](https://medium.com/google-cloud/configuring-mcp-servers-and-skills-for-antigravity-cli-and-ide-a938c7eebb78). Reinstates support after the v0.1.1 removal of `gemini-cli`.
- **Marker-based activation detection.** `extractActivationMarkers(skill)` walks the SKILL.md body and pulls out backtick-quoted output formats that mention the skill's name (e.g. `` `csv-summarizer: <filename> (N rows × M columns)` `` → marker `csv-summarizer:`). When markers exist, activation requires a literal match in the agent's output — kills the false-positive that v0.1's keyword heuristic produced on generic answers. Falls back to keyword detection when no markers exist.
- **HTML report** via `--html <path>`. Self-contained file (no external CSS / fonts), dark / light auto, collapsible per-platform outputs. Safe against HTML injection in skill names, tasks, or platform output.
- New env vars: `SKILLPORT_CURSOR_BIN`, `SKILLPORT_CURSOR_ARGS`, `SKILLPORT_ANTIGRAVITY_BIN`, `SKILLPORT_ANTIGRAVITY_ARGS`.

### Notes
- **Windsurf** is intentionally absent. Codeium's Windsurf was acquired by Cognition and rebranded to Devin Desktop on 2026-06-02; legacy Cascade is end-of-life 2026-07-01. Adapter is parked until Devin's non-interactive CLI mode stabilizes.

## [0.1.1] - 2026-06-23

### Removed
- **`gemini-cli` adapter.** Google [deprecated Gemini CLI on 2026-06-18](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) in favor of Antigravity CLI. Antigravity inherits SKILL.md support but its skill-loading paths are global-only (no project-scoped layout), which conflicts with skillport's sandbox model. Adapter deferred to v0.2 once project-scoped support is verified on a real install.

### Changed
- `PlatformId` no longer includes `'gemini-cli'`; `'antigravity'` reserved for v0.2.
- README's supported-platforms table updated; tagline no longer claims Gemini CLI.

## [0.1.0] - 2026-06-23

Initial release.

### Added
- `skillport test <skill-dir> --task "..."` — run one skill across multiple agent platforms and produce a compatibility report.
- Adapters for **Claude Code**, **OpenAI Codex CLI**, and **Gemini CLI**.
- Activation detection (did the agent actually load the skill?) and structural-similarity comparison out of the box.
- Optional semantic-similarity comparison via OpenAI embeddings (`OPENAI_API_KEY`).
- `--json` output for CI use.
- Bundled example skill (`examples/csv-formatter/`) and a quickstart task.
