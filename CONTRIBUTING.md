# Contributing to skillport

Thanks for taking a look. This project is small and aims to stay sharp — one tool, one job: tell skill authors when their skill behaves differently across agent platforms.

## How to contribute

### Filing issues

Two kinds of issues are most useful:

1. **"My skill produced different output on platform X."** Include the skill (or a minimal reproducer), the task description, and the two outputs. These reports drive the comparison engine.
2. **"Platform Y should be supported."** Tell us how Y loads skills (install path + invocation flag) and we'll add an adapter.

### Adding a platform adapter

1. Add `src/adapters/<platform>.ts` implementing the `Adapter` interface in `src/adapters/base.ts`.
2. Wire it up in `src/adapters/index.ts`.
3. Update the supported-platforms table in `README.md`.
4. Add a smoke test in `test/adapters/<platform>.test.ts`.

An adapter needs three things: `installSkill(skill)`, `run(task)`, `uninstallSkill(skill)`. Keep it under 100 lines.

### Local development

```bash
npm install
npm run dev -- test ./examples/csv-formatter --task "$(cat ./examples/csv-formatter/task.txt)"
```

`npm test` runs vitest; `npm run lint` is a type-check pass; `npm run build` produces `dist/`.

### Style

- TypeScript strict mode, ESM.
- No comments unless the why is non-obvious.
- Adapters fail closed — if a platform CLI isn't installed, the adapter reports it instead of crashing the run.

### Code of Conduct

Be direct, be kind, assume good faith. Don't ship anything you wouldn't want a stranger to debug at 2am.
