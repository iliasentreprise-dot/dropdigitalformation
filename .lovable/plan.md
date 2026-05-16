This is a big batch. Here is what I'll ship in one pass. A few features reference tabs (`ProfilTab`, `ParametresTab`) that don't yet exist in `index.tsx` — I'll add them as part of the work.

## 1. Database migration (single file)

- `chapter_resources` (id, chapter_id FK, title, file_url, file_type, position) + RLS (auth read, admin manage)
- `module_completions` (user_id, module_id, completed_at, unique) + RLS
- `chapter_reactions` (user_id, chapter_id, reaction enum-checked) + RLS
- `profiles`: `ADD COLUMN IF NOT EXISTS` for bio / show_progression / username_changed (already present, kept idempotent)
- Storage buckets: `chapter-resources` (public), `module-thumbnails` (public), `avatars` (public) with RLS upload/delete by owner/admin

## 2. Player layout (module.$moduleId.tsx + player.$chapterId.tsx)
- Title `<h1.player-title>` rendered ABOVE `.player-video-wrap`
- Description `<p.player-desc>` BELOW video, then actions
- Resources section under description
- Reactions row under validate button
- Auto-play next chapter countdown overlay (5s with Annuler)
- Trigger completion certificate modal on last chapter validation

## 3. Theming system
- New `src/lib/theme-context.tsx` with `ThemeProvider` + `useTheme`
- `__root.tsx` wraps with `ThemeProvider`; inline script in `<head>` sets `data-theme` before paint to avoid flash
- `dropdigital.css`, `player.css`, `admin.css`: add `:root[data-theme="dark"]` / `[data-theme="light"]` token blocks and replace hardcoded colors with `var(--bg-main)` etc. (targeted replacements — not full rewrite)

## 4. Home page (index.tsx) — significant expansion
- Add tabs: Modules / Profil / Paramètres / Communauté placeholders. Add **ProfilTab** (avatar upload, full_name, username one-time, bio + counter, show_progression toggle, real progression %, flash messages) and **ParametresTab** (theme toggle wired to `useTheme`)
- Settings ⚙ button in topbar → switches to `parametres` tab
- "Continuer là où tu t'es arrêté" card above sections, fetched from latest `user_chapter_progress` joined with chapters+modules
- Sticky top 3px global progress bar (actually lives in `__root.tsx` so it appears everywhere; reads counts when user is signed in)

## 5. Admin (admin.tsx)
- Module form: replace thumbnail URL input with dropzone uploader (uploads to `module-thumbnails`, shows 60×40 preview, "✅ Miniature uploadée", URL-toggle fallback)
- Chapter form: add Resources section (drop PDF → upload to `chapter-resources/{chapterId}/...` → insert row; list existing with editable title + Supprimer)
- New **Dashboard tab** at top with 4 stat cards (active students, completions total, avg completion rate, most popular module) + "Progression par module" table sorted desc

## 6. Misc
- `theme` applied via `data-theme` on `<html>`
- New components stay in `src/components/dd/` (CertificateModal, ResourcePicker, ThumbnailUploader, NextChapterCountdown, ReactionsRow, GlobalProgressBar)
- TypeScript strict respected
- All UI text in French to match existing app

## Technical notes
- Storage uploads go directly via `supabase.storage.from(...).upload(...)` from the browser (RLS controlled)
- Reaction insert uses upsert on `(user_id, chapter_id)` since constraint UNIQUE — toggle by delete+insert
- Module completion insert uses `onConflict: 'user_id,module_id'` ignore-duplicates
- Certificate download = `window.print()` of a styled div with print stylesheet (keeps it simple, no html2canvas dep)
- Global progress bar reads via a lightweight hook `useGlobalProgress()` that subscribes to a custom event so validations refresh it without a full reload

## Risks / scope acknowledgments
- This is ~12 files touched + 6 new components + 1 migration. I will not pre-seed any data.
- The CSS variable migration in 3 files is partial — I'll convert the most-used hardcoded colors (background, card, text, accent, border) but won't touch every gradient or shadow if the visual change would be subtle. Light mode will be functional but may need minor polish.
- Existing `ProfilTab`/`ParametresTab` are referenced in the spec but missing in current code; I'll create them.

Confirm and I'll execute the whole batch.