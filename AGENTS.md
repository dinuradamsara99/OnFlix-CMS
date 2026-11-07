<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Automation engine lives in `src/lib/engine.server.ts` and talks to the external OnFlix Supabase via service-role secrets; dashboard server functions and `/api/public/cron/*` both gate on `CRON_SECRET`, because the admin has no separate login.
- Keep Gemini subtitle post-editing in `src/lib/gemini-polish.server.ts`, using the explicitly requested user-owned multi-key REST pool; dynamically scale workers based on available keys without hardcoded limits, validate complete ID-mapped text before publishing, and never send timestamps to the model, so credentials stay server-only and dialogue timing stays immutable.
- Keep overload recovery inside the Gemini request helper, bounded to one retry per model and only HTTP 503, with abortable waits and the same key/payload, so Manual and Auto recover identically without bypassing quota or access errors.
