# Portfolio + private resume studio

Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/Postgres, and React PDF. The original static site remains at the repository root, so the current GitHub Pages deployment is not changed by this app.

## Run locally

Use Node.js 24 LTS (the app requires Node.js 22 or newer). A `.nvmrc` file pins the tested major version. On Windows PowerShell, use `npm.cmd` if script policy blocks `npm.ps1`.

Use the existing checkout; no worktree is necessary.

```sh
cd /workspace/muzammil-portfolio/web
npm ci
npm run dev
```

Open the development server on port 3000. `/login` is the owner sign-in screen. Without Supabase settings it explains setup and links to `/admin?demo=1`. The demo never authenticates or publishes and stores versions only in memory; refreshing clears them. Export JSON to retain a local copy. It supports editing, JD keyword matching, private-session versions, and client-side PDF export.

Validation: `npm test`, `npm run typecheck`, `npm run build`.

Repeatable browser checks: run `npx playwright install chromium` once, then `npm run test:browser` after building. In this cloud workspace, use the installed browser instead: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser`. These tests cover the public pages, demo version isolation, PDF/JSON export, and anonymous API rejection. `npm test` also executes the exact SQL migration in an in-memory PostgreSQL instance to check owner, non-owner, and anonymous row-security behavior; actual Supabase sign-in and deployment remain separate integration checks.

## Connect Supabase securely

1. Create a Supabase project. In **Authentication → Providers → Email**, disable **Allow new users to sign up**. Use the Auth Users dashboard to create your own user with a strong password and confirmed email. Do not add a public registration flow.
2. Copy your user's UUID from the Auth Users dashboard.
3. Run `supabase/schema.sql` once in the SQL editor. Then run the final commented `insert into public.resume_admins` statement with your real Auth user UUID. The SQL is an initial migration, not a script to rerun blindly; existing policies/triggers will need migrations for future changes.
4. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API. Set server-only `RESUME_OWNER_ID` to the exact same Auth UUID you registered in `resume_admins`. Never add a Supabase service-role key to the app. Never commit `.env.local` or send passwords in chat.
5. Restart Next.js. Sign in at `/login`. The server verifies the session with Supabase and checks your UUID on every private API request. Database RLS separately checks that the user is registered in `resume_admins` and owns the row. Other authenticated users cannot access versions or publish.
6. Set the Supabase Site URL to your final HTTPS domain. Password login is used; there is no public signup or email-link callback route. For a forgotten password, use Supabase's owner administration/recovery tools; the app does not yet provide a recovery form.

## Your workflow

- After sign-in, the newest master profile opens automatically; if no master exists, the newest tailored version opens. The sticky action bar keeps save/export controls available while scrolling.
- Open `/admin` and edit your name, contact details, summary, skills, project dates, project tools, responsibilities, and education. Add/remove projects as needed.
- For CT-Incisive, edit **Project tools** to reflect your actual work. A private tailored version can emphasize Java/Selenium while a different version retains Python/TestComplete. Nothing is inferred or silently replaced.
- Paste a JD to see recognized skills already present and missing. This is deterministic keyword matching, not an AI model or an ATS score. “Prioritize matching skills” reorders existing skills only. Missing skills are never automatically added.
- **Save privately** saves the current version. **Save as new version** makes a separate copy. Choose master or tailored purpose and give each version a useful name. Version timestamps prevent silent overwrites from another tab.
- Choose **Readable — full experience** for larger typography and natural page breaks (two pages for the default profile). **Compact** is optional and uses tighter spacing. The layout is saved with each version; old versions default to Readable. No database migration is needed.
- **Download PDF** exports the current editor content without publishing it. Downloads are named `Muzammil_Patel_Resume_MM_YYYY.pdf`, using the generation month/year in Asia/Kolkata. Readable PDFs can split project sections to use page space efficiently; a project heading stays with its first bullet.
- **Export JSON backup** exports structured resume content; import restores it after validation. Backups contain personal data—store them privately.
- **Publish to portfolio** explicitly confirms that all fields in the preview become public. It writes a separate public snapshot. Private versions are never read by public routes. Publishing changes both the portfolio content and `/api/pdf`, while the demo cannot publish.
- A fresh app uses the approved seed profile until you publish a snapshot. This snapshot model means unsaved/private edits never affect the public website.

## Deploy on Vercel without breaking the current site

1. Create a Vercel account and import this GitHub repository. Set **Root Directory** to `web`. Framework: Next.js. Build command: `npm run build`.
2. Add the three environment variables from `.env.example` in Vercel project settings, using the same Supabase project and owner UUID. Keep `RESUME_OWNER_ID` server-only. Configure preview environments deliberately; avoid connecting unreviewed preview branches to the production database.
3. Deploy to the temporary Vercel domain first. Run all checks below. The app needs Node.js server functions and cannot run as the current static GitHub Pages site. Do not configure `output: export`.
4. Only after testing, add `muzammilpatel.com` in Vercel Domains and follow the exact DNS records Vercel supplies. Update the Supabase Site URL. DNS setup depends on your registrar; do not copy invented DNS values.
5. Keep the old GitHub Pages deployment available until the new domain works. No DNS or hosting settings have been changed by this implementation.

## Required checks before production

These require a real Supabase project and are not validated by local demo tests:

- Owner sign-in; saved versions persist after logout and login.
- A second, non-owner user cannot GET/POST `/api/versions`, POST `/api/pdf`, or POST `/api/publish` (403). Direct Supabase requests from that user also cannot read/write private tables.
- Anonymous callers cannot access any private API or resume_versions rows.
- Save two versions, edit one, and confirm the other and public portfolio remain unchanged.
- Edit the same version in two tabs; saving the stale copy returns 409 rather than silently overwriting.
- Publishing updates public project cards, skills, resume page, and public PDF. Unpublished changes remain private.
- Database backups and Supabase rate limits are configured for your account. Enable MFA for your Supabase and Vercel dashboard accounts.

## Scope and limitations

No paid AI service, AI key, or external JD upload is required. JDs stay in the current browser state; they are not saved to the database. The public phone, email, and profile are intentionally publishable. PDF layout adapts to content and may span multiple pages. The editor manages resume content, not blog posts, theme settings, education entries as separate records, or deployment/DNS. Contact/social account links remain owner-specific constants in the app.

## Updating an extracted Windows copy

If you extract an updated ZIP over the same folder, preserve your `web/.env.local`; it is not included in the ZIP. Stop the server with Ctrl+C before replacing files. Find the `web` folder that contains both `package.json` and your `.env.local`, then run `npm.cmd ci --include=optional` and `npm.cmd run dev`. ZIP tools sometimes create a nested second project folder; start the server from the updated `web` folder, not the old parent. Supabase-saved versions live in your database and are not removed when you replace app code. Do not delete your Supabase project or owner user to update the app.

## Learning lab

Open `/learning/index.html` in the Next.js app, or `/learning/` on the static portfolio. The checked-in `learning/` assets are mirrored in `web/public/learning/`; keep both copies identical. The hub includes nine lessons, explanatory quizzes, local code scratchpads, reference solutions, and a preparation plan through December 20, 2026. The interview is after that date; no exact interview date is assumed. Progress and drafts use the browser's `mp-learning-v1` localStorage key, with a confirmed reset. There is no code execution or cross-device sync. Practice completion is self-reported.

Daily streaks count lesson completion, correct quiz answers (including review), or self-reviewed exercises once per calendar day in Asia/Kolkata. The current streak remains active until a full day is missed; the best streak and seven-day activity strip persist alongside progress. Mobile layouts use a sticky subject/continue toolbar, horizontal lesson navigation, larger answer targets, and 16px scratchpad text.
