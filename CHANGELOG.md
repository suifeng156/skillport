# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-06-23

Initial release.

### Added
- `skillport test <skill-dir> --task "..."` — run one skill across multiple agent platforms and produce a compatibility report.
- Adapters for **Claude Code**, **OpenAI Codex CLI**, and **Gemini CLI**.
- Activation detection (did the agent actually load the skill?) and structural-similarity comparison out of the box.
- Optional semantic-similarity comparison via OpenAI embeddings (`OPENAI_API_KEY`).
- `--json` output for CI use.
- Bundled example skill (`examples/csv-formatter/`) and a quickstart task.
