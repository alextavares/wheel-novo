# CRUSH.md

Build / run / test
- Root e2e (Playwright): npm test | npm run test:ui | npx playwright test tests/e2e/<file>.spec.ts -g "<name>"
- Root single test file: npx playwright test tests/e2e/inputs-panel.spec.ts
- Root single test by title: npx playwright test -g "title substring"
- wheelwheel app dev: pnpm dev OR npm run dev --workspace=wheelwheel
- wheelwheel build/start: npm run build --workspace=wheelwheel && npm run start --workspace=wheelwheel
- wheelwheel lint: npm run lint --workspace=wheelwheel
- wheelwheel SEO generators: npm run seo:generate --workspace=wheelwheel (see other seo:* scripts)

Repo layout
- Root: Playwright tests and minimal package.json for e2e; Next.js apps live in wheelwheel/, wheel2-project/, modern-wheel/; many build artifacts in .next/ folders.
- Primary active app: wheelwheel (Next 15, React 19, Tailwind 4, TypeScript 5). Scripts above assume workspace commands run from repo root.

Testing notes
- Playwright config: playwright.config.ts at root. Tests in tests/e2e/*.spec.ts. Prefer explicit test titles; use -g to run a single test.
- For app-level unit tests: none configured; add per-app testing if needed.

Code style
- Language: TypeScript, React Server Components (Next 15). Use .ts/.tsx; prefer explicit types for public APIs and props.
- Imports: absolute within app aliases when defined; otherwise relative. Group as: react/next, third-party, internal. No default exports for shared utilities; prefer named.
- Formatting: Prettier-style 2 spaces, single quotes or Next defaults; keep lines <= 100 chars. No inline comments in generated diffs unless requested.
- Components: PascalCase for components/files; hooks use camelCase with use*; types/interfaces PascalCase; constants UPPER_SNAKE_CASE.
- State: prefer React hooks, server actions when appropriate; avoid any; use unknown or generics; narrow with type guards.
- Error handling: never swallow errors; throw Error with message; for API routes return NextResponse with proper status; log minimal context (no secrets).
- Async: always await; wrap critical paths in try/catch and rethrow or surface via UI/toast.
- Styling: Tailwind where present; prefer className composition helpers; keep UI pure.
- Files: avoid large monoliths; co-locate small helpers next to usage or in src/utils.

AI assistant rules
- Cursor rules: wheelwheel/claude-code-mcp/.windsurfrules and claude-code-mcp/CURSOR.md present; follow repository conventions above; do not commit secrets; keep PR summaries concise.
- Copilot rules: claude-code-mcp/.github/copilot-instructions.md exists; prefer explicit, typed code; small focused changes.

Notes
- Use workspace flags when running app scripts from root. If pnpm/yarn workspaces are not set up, cd into app dir and run scripts there.
