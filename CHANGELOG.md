# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
