# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Documentation Language

- Write documentation files in English by default.
- Prefer English for developer-facing text, design notes, specifications, and operational documentation.
- If a document is intentionally bilingual or Japanese-only, keep that choice explicit and consistent.

## README Files

This repository has two README files:

- `README.md`
  - English
- `README-ja_JP.md`
  - Japanese

When updating high-level product or usage documentation, check whether both README files should be updated together.

## Documentation Placement

Use the following rough guidance when adding or updating documents:

- `README.md`
  - English top-level project overview and quick-start information
- `README-ja_JP.md`
  - Japanese counterpart of the top-level README
- `DEVELOPER_NOTES.md`
  - build, development, deployment, and maintenance notes
- `docs/`
  - longer-form documentation such as specifications, design notes, or architecture documents

## Consistency

- Keep terminology consistent across `README.md`, `README-ja_JP.md`, `DEVELOPER_NOTES.md`, and files under `docs/`.
- When behavior changes, update the affected documentation in the same change when practical.
