# MOBLUX OS — Agent Guidance

This document defines how Codex and other coding agents should preserve project context and maintain the repository during long-term development across multiple computers.

- Before making significant changes, read `AGENTS.md` and the relevant files in `docs/`.
- Document important architectural and business decisions in `docs/DECISIONS.md`, including their context and rationale, and update the affected documents.
- Do not invent business requirements when information is missing. Ask for clarification or record the unresolved issue in `docs/OPEN_QUESTIONS.md`; do not treat an assumption as an approved requirement.
- Develop the software incrementally, using small, reviewable changes and keeping documentation aligned with agreed behavior.
- Do not perform large architectural rewrites without documenting the reason, alternatives, and implications in `docs/DECISIONS.md`.
- Keep the repository portable between computers. Prefer repository-relative paths and avoid hard-coded machine-specific paths or undocumented local setup requirements.
- Never commit secrets, passwords, API keys, credentials, or production customer data. Keep sensitive information out of code, documentation, examples, fixtures, and version history.

## Current project stage

The repository is in the documentation and planning stage. The final technology stack has not been selected. Until further instruction, do not create application code, install packages or dependencies, select the final stack, or modify the existing Git configuration.

## Project context

- `docs/MASTER_SPEC.md`: agreed scope and requirements.
- `docs/ARCHITECTURE.md`: system structure and technical boundaries.
- `docs/BUSINESS_FLOW.md`: agreed business workflows.
- `docs/DOMAIN_MODEL.md`: business concepts and relationships.
- `docs/PERMISSIONS.md`: roles and access rules.
- `docs/POLYBOARD_IMPORT.md`: Polyboard import requirements and mapping.
- `docs/ROADMAP.md`: incremental development plan.
- `docs/DECISIONS.md`: important decisions and their rationale.
- `docs/OPEN_QUESTIONS.md`: unresolved questions needing clarification.
