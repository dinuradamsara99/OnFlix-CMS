import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// ─── Message schema ───────────────────────────────────────────────────────────
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().max(32_000),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const Body = z.object({
  key: z.string().max(500),
  messages: z.array(MessageSchema).min(1).max(100),
});

// ─── Tool definitions sent to Groq ───────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Search OnFlix content library by title. Returns up to 12 matching items with their id, title, type, featured status, and rating.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Title search query" },
          content_type: { type: "string", enum: ["movie", "tv_show", "any"], description: "Filter by content type" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_ten",
      description: "Get the current Top 10 movies and Top 10 TV shows as displayed on the OnFlix homepage.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_top_ten",
      description: "Update the Top 10 list for movies or TV shows. Provide an ordered array of content IDs (position 0 = rank 1). After updating, the OnFlix web is revalidated automatically.",
      parameters: {
        type: "object",
        properties: {
          content_type: { type: "string", enum: ["movie", "tv_show"], description: "Which Top 10 list to update" },
          content_ids: { type: "array", items: { type: "number" }, description: "Ordered array of OnFlix content IDs (max 10)", maxItems: 10 },
        },
        required: ["content_type", "content_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_featured",
      description: "Get all content currently featured in the OnFlix hero slider.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_featured",
      description: "Add or remove a content item from the hero slider. Revalidates OnFlix web automatically.",
      parameters: {
        type: "object",
        properties: {
          content_id: { type: "number", description: "OnFlix content ID" },
          featured: { type: "boolean", description: "true to add to slider, false to remove" },
        },
        required: ["content_id", "featured"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_content_status",
      description: "Change the publication status of a title to 'published', 'draft', or 'archived'. Setting to 'draft' or 'archived' unpublishes/hides the title from the website. Automatically revalidates OnFlix web.",
      parameters: {
        type: "object",
        properties: {
          content_id: { type: "number", description: "OnFlix content ID" },
          status: { type: "string", enum: ["published", "draft", "archived"], description: "New status: published, draft (unpublished/hidden), or archived" },
        },
        required: ["content_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_content",
      description: "Permanently delete a content item from the database. Revalidates OnFlix web automatically.",
      parameters: {
        type: "object",
        properties: {
          content_id: { type: "number", description: "OnFlix content ID to delete" },
        },
        required: ["content_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_job_stats",
      description: "Get subtitle automation job statistics: counts by status (upcoming, processing, completed, failed, etc.).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_requests",
      description: "Get user title requests that are pending processing. Shows what users want subtitled next.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user_request_status",
      description: "Update the status of a user title request to 'pending', 'approved', 'completed', or 'rejected'.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number", description: "Request ID" },
          status: { type: "string", enum: ["pending", "approved", "completed", "rejected"], description: "New request status" },
        },
        required: ["request_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tmdb",
      description: "Look up movie/TV details on TMDB (The Movie Database) by title or numeric TMDB ID.",
      parameters: {
        type: "object",
        properties: {
          query_or_id: { type: "string", description: "Movie/TV title or numeric TMDB ID" },
          media_type: { type: "string", enum: ["movie", "tv", "any"], description: "Filter by movie or tv" },
        },
        required: ["query_or_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queue_title",
      description: "Add a new movie or TV show to the automation queue to translate and upload to OnFlix using its TMDB ID.",
      parameters: {
        type: "object",
        properties: {
          tmdb_id: { type: "number", description: "TMDB ID of the title" },
          media_type: { type: "string", enum: ["movie", "tv"], description: "movie or tv. Defaults to 'movie' if unspecified" },
          season: { type: "number", description: "Season number (for TV shows, e.g. 1)" },
          episode: { type: "number", description: "Episode number (for TV shows, e.g. 1)" },
        },
        required: ["tmdb_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_curate_top_ten",
      description: "Automatically curate and rank the Top 10 list for movies or TV shows based on highest rating or latest releases. Automatically revalidates OnFlix web.",
      parameters: {
        type: "object",
        properties: {
          content_type: { type: "string", enum: ["movie", "tv_show"], description: "movie or tv_show" },
          criteria: { type: "string", enum: ["rating", "latest"], description: "ranking criteria" },
        },
        required: ["content_type", "criteria"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_curate_hero_slider",
      description: "Automatically pick and feature the best titles for the homepage Hero Slider based on highest rating or latest releases. Automatically revalidates OnFlix web.",
      parameters: {
        type: "object",
        properties: {
          criteria: { type: "string", enum: ["rating", "latest"], description: "criteria to select featured titles" },
          count: { type: "number", description: "Number of titles to feature (default 5, max 10)" },
        },
        required: ["criteria"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_embed_health",
      description: "Verify video stream availability on EmbedMaster for Top 10, Hero Slider, or a specific title.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["top_ten", "featured", "specific"], description: "which content group to check" },
          content_id: { type: "number", description: "content ID if target is 'specific'" },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_fulfill_requests",
      description: "Batch fulfill pending user requests: pulls TMDB metadata, queues automation jobs, and approves requests.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max requests to fulfill (default 5, max 15)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_health_report",
      description: "Comprehensive health report of OnFlix: published content, missing subtitles, automation status, and pending user requests.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_missing_subtitles",
      description: "List published movies or TV shows that lack Sinhala subtitles on OnFlix. Movies have their subtitle on content.sinhala_subtitle_url. TV Shows store subtitles per-episode in the episodes table for released episodes only. Supports content_type filter: 'movie' (for films), 'tv_show', or 'all'.",
      parameters: {
        type: "object",
        properties: {
          content_type: { type: "string", enum: ["movie", "tv_show", "all"], description: "Filter by content type ('movie' for films, 'tv_show' for series, or 'all'). Defaults to 'movie' if user asks about films or movies." },
          limit: { type: "number", description: "Max titles to list (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queue_missing_subtitles",
      description: "Automatically queue all published movies/shows that lack Sinhala subtitles into the subtitle automation queue.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max titles to queue (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_announcement",
      description: "View, update, or disable the sitewide announcement banner on the OnFlix web homepage.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get", "set", "disable"], description: "action to perform" },
          message: { type: "string", description: "Announcement text (required for 'set')" },
          type: { type: "string", enum: ["info", "warning", "alert"], description: "banner style" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_glossary",
      description: "View or manage custom Sinhala subtitle glossary terms (e.g. character names, slang, terminology) used during translation.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "add", "remove"], description: "list, add, or remove" },
          english: { type: "string", description: "English word or phrase" },
          sinhala: { type: "string", description: "Sinhala translation (required for 'add')" },
        },
        required: ["action"],
      },
    },
  },
] as const;

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { db, getSettings, revalidateOnflixWeb } = await import("@/lib/engine.server");
  const sb = db();

  if (name === "search_content") {
    const q = String(args["query"] ?? "").trim();
    const ct = args["content_type"] as string | undefined;
    let query = sb.from("content")
      .select("id, title, type, tmdb_id, featured, status, rating");
    if (/^\d+$/.test(q)) {
      query = query.or(`tmdb_id.eq.${q},id.eq.${q},title.ilike.%${q}%`);
    } else {
      query = query.ilike("title", `%${q}%`);
    }
    if (ct && ct !== "any") query = query.eq("type", ct);
    const { data, error } = await query.limit(8);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (name === "get_top_ten") {
    const { data, error } = await sb.from("site_settings")
      .select("key, value")
      .in("key", ["top_10_movies", "top_10_tv_shows"]);
    if (error) throw new Error(error.message);
    const result: Record<string, unknown[]> = { top_10_movies: [], top_10_tv_shows: [] };
    for (const row of data ?? []) {
      try { result[row["key"] as string] = JSON.parse(row["value"] as string); } catch { /* noop */ }
    }
    // Enrich with titles
    const movies = (result["top_10_movies"] as number[] | undefined) ?? [];
    const tvShows = (result["top_10_tv_shows"] as number[] | undefined) ?? [];
    const allIds = [...movies, ...tvShows];
    if (allIds.length > 0) {
      const { data: content } = await sb.from("content").select("id, title, type, featured").in("id", allIds);
      const contentMap = new Map((content ?? []).map((c: { id: number; title: string; type: string; featured: boolean }) => [c.id, c]));
      result["top_10_movies"] = movies.map((id, i) => ({ rank: i + 1, id, ...(contentMap.get(id) ?? {}) }));
      result["top_10_tv_shows"] = tvShows.map((id, i) => ({ rank: i + 1, id, ...(contentMap.get(id) ?? {}) }));
    }
    return result;
  }

  if (name === "set_top_ten") {
    const ct = String(args["content_type"] ?? "movie");
    const ids = ((args["content_ids"] as number[] | undefined) ?? []).slice(0, 10);
    const key = ct === "tv_show" ? "top_10_tv_shows" : "top_10_movies";
    const { error } = await sb.from("site_settings")
      .upsert({ key, value: JSON.stringify(ids), updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    // Revalidate
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, null, { tmdb_id: 0, media_type: ct === "tv_show" ? "tv" : "movie" });
    } catch { /* revalidation best-effort */ }
    return { success: true, key, count: ids.length, ids };
  }

  if (name === "get_featured") {
    const { data, error } = await sb.from("content")
      .select("id, title, type, status, rating")
      .eq("featured", true)
      .eq("status", "published")
      .order("title")
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (name === "set_featured") {
    const id = Number(args["content_id"]);
    const featured = Boolean(args["featured"]);
    // Get content info first
    const { data: contentRow, error: fetchErr } = await sb.from("content")
      .select("id, title, slug, type")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!contentRow) throw new Error(`Content with id ${id} not found`);
    const { error } = await sb.from("content")
      .update({ featured, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    // Revalidate
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, contentRow, { tmdb_id: id, media_type: contentRow.type === "tv_show" ? "tv" : "movie" });
    } catch { /* revalidation best-effort */ }
    return { success: true, id, title: contentRow.title, featured };
  }

  if (name === "set_content_status") {
    const id = Number(args["content_id"]);
    const status = String(args["status"] ?? "draft");
    const { data: contentRow, error: fetchErr } = await sb.from("content")
      .select("id, title, slug, type")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!contentRow) throw new Error(`Content with id ${id} not found`);
    const { error } = await sb.from("content")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (status !== "published") {
      await sb.from("content").update({ featured: false }).eq("id", id);
    }
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, contentRow, { tmdb_id: id, media_type: contentRow.type === "tv_show" ? "tv" : "movie" });
    } catch { /* revalidation best-effort */ }
    return { success: true, id, title: contentRow.title, status };
  }

  if (name === "delete_content") {
    const id = Number(args["content_id"]);
    const { data: contentRow, error: fetchErr } = await sb.from("content")
      .select("id, title, slug, type")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!contentRow) throw new Error(`Content with id ${id} not found`);
    const { error } = await sb.from("content").delete().eq("id", id);
    if (error) throw new Error(error.message);
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, contentRow, { tmdb_id: id, media_type: contentRow.type === "tv_show" ? "tv" : "movie" });
    } catch { /* revalidation best-effort */ }
    return { success: true, id, title: contentRow.title, deleted: true };
  }

  if (name === "get_job_stats") {
    const { data, error } = await sb.from("subtitle_automation_jobs")
      .select("status");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return { total: (data ?? []).length, by_status: counts };
  }

  if (name === "get_pending_requests") {
    const { data, error } = await sb.from("requests")
      .select("id, title, type, tmdb_id, status, created_at, email")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (name === "update_user_request_status") {
    const id = Number(args["request_id"]);
    const status = String(args["status"]);
    const { error } = await sb.from("requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true, id, status };
  }

  if (name === "search_tmdb") {
    const { tmdb } = await import("@/lib/engine.server");
    const q = String(args["query_or_id"] ?? "").trim();
    const mt = (args["media_type"] as string | undefined) ?? "movie";
    if (/^\d+$/.test(q)) {
      try {
        const d = await tmdb(`/${mt === "tv" ? "tv" : "movie"}/${q}`) as {
          id: number;
          title?: string;
          name?: string;
          release_date?: string;
          first_air_date?: string;
          overview?: string;
          vote_average?: number;
        };
        return [{
          id: d.id,
          title: d.title || d.name,
          type: mt === "tv" ? "tv" : "movie",
          release_date: d.release_date || d.first_air_date,
          overview: d.overview?.slice(0, 200),
          vote_average: d.vote_average,
        }];
      } catch {
        return { error: `TMDB ID ${q} not found on TMDB.` };
      }
    }
    try {
      const searchRes = await tmdb(`/search/${mt === "tv" ? "tv" : "movie"}`, { query: q }) as {
        results?: Array<{
          id: number;
          title?: string;
          name?: string;
          release_date?: string;
          first_air_date?: string;
          vote_average?: number;
        }>;
      };
      return (searchRes.results ?? []).slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title || r.name,
        type: mt === "tv" ? "tv" : "movie",
        release_date: r.release_date || r.first_air_date,
        vote_average: r.vote_average,
      }));
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  if (name === "queue_title") {
    const { tmdb } = await import("@/lib/engine.server");
    const tmdbId = Number(args["tmdb_id"]);
    let mediaType = (args["media_type"] as string) === "tv" ? "tv" : "movie";
    const season = Number(args["season"] || 0);
    const episode = Number(args["episode"] || 0);

    let title = "";
    let releaseDate: string | null = null;
    let popularity = 0;
    let runtime: number | null = null;
    let posterPath: string | null = null;

    try {
      if (mediaType === "movie") {
        try {
          const d = await tmdb(`/movie/${tmdbId}`) as {
            title: string;
            release_date?: string;
            popularity?: number;
            runtime?: number;
            poster_path?: string;
          };
          title = d.title;
          releaseDate = d.release_date || null;
          popularity = d.popularity ?? 0;
          runtime = d.runtime ?? null;
          posterPath = d.poster_path ?? null;
        } catch (mErr) {
          if (!args["media_type"]) {
            // Fallback: try TV show
            const d = await tmdb(`/tv/${tmdbId}`) as {
              name: string;
              first_air_date?: string;
              popularity?: number;
              poster_path?: string;
            };
            mediaType = "tv";
            title = `${d.name} S${season || 1}E${episode || 1}`;
            releaseDate = d.first_air_date || null;
            popularity = d.popularity ?? 0;
            posterPath = d.poster_path ?? null;
          } else {
            throw mErr;
          }
        }
      } else {
        const d = await tmdb(`/tv/${tmdbId}`) as {
          name: string;
          first_air_date?: string;
          popularity?: number;
          poster_path?: string;
        };
        title = `${d.name} S${season || 1}E${episode || 1}`;
        releaseDate = d.first_air_date || null;
        popularity = d.popularity ?? 0;
        posterPath = d.poster_path ?? null;
      }
    } catch {
      throw new Error(`TMDB ID ${tmdbId} was not found on TMDB.`);
    }

    const { data: row, error } = await sb
      .from("subtitle_automation_jobs")
      .upsert(
        {
          tmdb_id: tmdbId,
          media_type: mediaType,
          title,
          season_number: season,
          episode_number: episode,
          release_date: releaseDate,
          popularity,
          runtime,
          poster_path: posterPath,
          status: "waiting_embed",
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tmdb_id,media_type,season_number,episode_number" },
      )
      .select("id, title, status, tmdb_id")
      .single();

    if (error) throw new Error(error.message);
    return { success: true, message: `Successfully queued '${title}' (TMDB ID: ${tmdbId}) for subtitle automation.`, job: row };
  }

  if (name === "auto_curate_top_ten") {
    const ct = String(args["content_type"] ?? "movie");
    const criteria = String(args["criteria"] ?? "rating");
    let query = sb.from("content")
      .select("id, title, rating, release_year, created_at")
      .eq("type", ct)
      .eq("status", "published");

    if (criteria === "rating") {
      query = query.order("rating", { ascending: false }).order("vote_count", { ascending: false });
    } else {
      query = query.order("release_year", { ascending: false }).order("created_at", { ascending: false });
    }

    const { data: items, error } = await query.limit(10);
    if (error) throw new Error(error.message);
    const ids = (items ?? []).map((it) => it["id"] as number);
    const key = ct === "tv_show" ? "top_10_tv_shows" : "top_10_movies";
    await sb.from("site_settings")
      .upsert({ key, value: JSON.stringify(ids), updated_at: new Date().toISOString() }, { onConflict: "key" });
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, null, { tmdb_id: 0, media_type: ct === "tv_show" ? "tv" : "movie" });
    } catch { /* best-effort */ }
    return {
      success: true,
      key,
      criteria,
      count: ids.length,
      top_10: (items ?? []).map((it, i) => ({ rank: i + 1, id: it["id"], title: it["title"], rating: it["rating"] })),
    };
  }

  if (name === "auto_curate_hero_slider") {
    const criteria = String(args["criteria"] ?? "rating");
    const count = Math.min(Math.max(1, Number(args["count"] ?? 5)), 10);
    let query = sb.from("content")
      .select("id, title, rating, type")
      .eq("status", "published");
    if (criteria === "rating") {
      query = query.order("rating", { ascending: false });
    } else {
      query = query.order("release_year", { ascending: false }).order("created_at", { ascending: false });
    }
    const { data: topItems, error } = await query.limit(count);
    if (error) throw new Error(error.message);
    const newFeaturedIds = (topItems ?? []).map((it) => it["id"] as number);
    await sb.from("content").update({ featured: false, updated_at: new Date().toISOString() }).eq("featured", true);
    if (newFeaturedIds.length > 0) {
      await sb.from("content").update({ featured: true, updated_at: new Date().toISOString() }).in("id", newFeaturedIds);
    }
    try {
      const s = await getSettings();
      await revalidateOnflixWeb(s, null, { tmdb_id: 0, media_type: "movie" });
    } catch { /* best-effort */ }
    return {
      success: true,
      criteria,
      featured_count: newFeaturedIds.length,
      titles: (topItems ?? []).map((it) => ({ id: it["id"], title: it["title"], rating: it["rating"] })),
    };
  }

  if (name === "check_embed_health") {
    const target = String(args["target"] ?? "top_ten");
    const contentId = Number(args["content_id"] || 0);
    const s = await getSettings();
    const { probeEmbed } = await import("@/lib/engine.server");

    let targets: Array<{ id: number; title: string; tmdb_id: number; type: string }> = [];

    if (target === "specific" && contentId) {
      const { data } = await sb.from("content").select("id, title, tmdb_id, type").eq("id", contentId).maybeSingle();
      if (data && data["tmdb_id"]) targets = [data as any];
    } else if (target === "featured") {
      const { data } = await sb.from("content").select("id, title, tmdb_id, type").eq("featured", true).eq("status", "published").limit(8);
      targets = (data ?? []).filter((d) => Boolean(d["tmdb_id"])) as any;
    } else {
      const { data } = await sb.from("site_settings").select("value").eq("key", "top_10_movies").maybeSingle();
      let ids: number[] = [];
      try { ids = JSON.parse(data?.value ?? "[]"); } catch {}
      if (ids.length > 0) {
        const { data: movies } = await sb.from("content").select("id, title, tmdb_id, type").in("id", ids);
        targets = (movies ?? []).filter((d) => Boolean(d["tmdb_id"])) as any;
      }
    }

    if (targets.length === 0) {
      return { message: "No content items with TMDB IDs found to inspect." };
    }

    const results = await Promise.all(
      targets.slice(0, 10).map(async (t) => {
        const healthy = await probeEmbed(s, { tmdb_id: t["tmdb_id"], media_type: t["type"] === "tv_show" ? "tv" : "movie", season_number: 1, episode_number: 1 });
        return { id: t["id"], title: t["title"], tmdb_id: t["tmdb_id"], status: healthy ? "playable" : "broken_or_no_source" };
      }),
    );

    const healthyCount = results.filter((r) => r.status === "playable").length;
    const brokenCount = results.filter((r) => r.status !== "playable").length;
    return { target, total_checked: results.length, healthy_count: healthyCount, broken_count: brokenCount, results };
  }

  if (name === "auto_fulfill_requests") {
    const limit = Math.min(Math.max(1, Number(args["limit"] ?? 5)), 15);
    const { data: requests, error } = await sb.from("requests")
      .select("id, title, tmdb_id, type")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    if (!requests || requests.length === 0) {
      return { message: "No pending user requests to fulfill." };
    }

    const { tmdb } = await import("@/lib/engine.server");
    const fulfilled: Array<{ id: number; title: string; tmdb_id: number; status: string }> = [];

    for (const req of requests) {
      try {
        const mediaType = req["type"] === "tv" ? "tv" : "movie";
        let title = req["title"] as string;
        let releaseDate: string | null = null;
        let popularity = 0;
        let runtime: number | null = null;
        let posterPath: string | null = null;

        if (mediaType === "movie") {
          const d = await tmdb(`/movie/${req["tmdb_id"]}`) as any;
          title = d.title || title;
          releaseDate = d.release_date || null;
          popularity = d.popularity ?? 0;
          runtime = d.runtime ?? null;
          posterPath = d.poster_path ?? null;
        } else {
          const d = await tmdb(`/tv/${req["tmdb_id"]}`) as any;
          title = `${d.name || title} S1E1`;
          releaseDate = d.first_air_date || null;
          popularity = d.popularity ?? 0;
          posterPath = d.poster_path ?? null;
        }

        await sb.from("subtitle_automation_jobs").upsert(
          {
            tmdb_id: req["tmdb_id"],
            media_type: mediaType,
            title,
            season_number: mediaType === "tv" ? 1 : 0,
            episode_number: mediaType === "tv" ? 1 : 0,
            release_date: releaseDate,
            popularity,
            runtime,
            poster_path: posterPath,
            status: "waiting_embed",
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tmdb_id,media_type,season_number,episode_number" },
        );

        await sb.from("requests").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", req["id"]);
        fulfilled.push({ id: req["id"], title, tmdb_id: req["tmdb_id"], status: "queued_and_approved" });
      } catch (err) {
        fulfilled.push({ id: req["id"], title: req["title"], tmdb_id: req["tmdb_id"], status: `failed: ${(err as Error).message}` });
      }
    }

    return { total_processed: fulfilled.length, fulfilled };
  }

  if (name === "get_health_report") {
    const { count: totalMovies } = await sb.from("content").select("id", { count: "exact", head: true }).eq("type", "movie").eq("status", "published");
    const { count: totalTv } = await sb.from("content").select("id", { count: "exact", head: true }).eq("type", "tv_show").eq("status", "published");
    const { data: missingSubMovies, count: missingMovieSubs } = await sb.from("content")
      .select("id, title, type, tmdb_id")
      .eq("type", "movie")
      .is("sinhala_subtitle_url", null)
      .eq("status", "published")
      .limit(10);

    const { data: jobs } = await sb.from("subtitle_automation_jobs").select("status");
    const jobCounts: Record<string, number> = {};
    for (const j of jobs ?? []) jobCounts[j["status"]] = (jobCounts[j["status"]] ?? 0) + 1;

    const { count: pendingRequests } = await sb.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending");

    return {
      platform: "OnFlix Streaming",
      published_content: {
        movies: totalMovies ?? 0,
        tv_shows: totalTv ?? 0,
        total: (totalMovies ?? 0) + (totalTv ?? 0),
        missing_movie_subtitles_count: missingMovieSubs ?? 0,
        missing_movies: (missingSubMovies ?? []).map((m) => ({ id: m["id"], title: m["title"], type: m["type"], tmdb_id: m["tmdb_id"] })),
        tv_show_subtitle_note: "TV Show subtitles are managed per episode in the episodes table. Unreleased episodes do not count as missing.",
      },
      automation_jobs: {
        total: (jobs ?? []).length,
        completed: jobCounts["completed"] ?? 0,
        processing: jobCounts["processing"] ?? 0,
        waiting_embed: jobCounts["waiting_embed"] ?? 0,
        waiting_subtitle: jobCounts["waiting_subtitle"] ?? 0,
        failed: jobCounts["failed"] ?? 0,
      },
      user_requests: {
        pending_review: pendingRequests ?? 0,
      },
      status: (jobCounts["failed"] ?? 0) > 10 ? "attention_needed" : "healthy",
    };
  }

  if (name === "get_missing_subtitles") {
    const limit = Math.min(Math.max(1, Number(args["limit"] ?? 20)), 50);
    const contentType = (args["content_type"] as string | undefined) ?? "all";

    type SubtitleMissingItem = {
      id: number;
      title: string;
      type: string;
      tmdb_id: number;
      year: number | null;
      rating: number | null;
      note?: string;
    };
    const results: SubtitleMissingItem[] = [];

    // 1. Movies (subtitles stored on content.sinhala_subtitle_url)
    if (contentType === "movie" || contentType === "all") {
      const { data: movies, error } = await sb.from("content")
        .select("id, title, type, tmdb_id, release_year, rating")
        .eq("type", "movie")
        .is("sinhala_subtitle_url", null)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      for (const m of movies ?? []) {
        results.push({
          id: m["id"] as number,
          title: m["title"] as string,
          type: "movie",
          tmdb_id: m["tmdb_id"] as number,
          year: m["release_year"] as number | null,
          rating: m["rating"] as number | null,
          note: "Movie subtitle missing",
        });
      }
    }

    // 2. TV Shows (only released episodes with embed_link or published status)
    if (contentType === "tv_show" || (contentType === "all" && results.length < limit)) {
      const { data: tvShows, error: tvErr } = await sb.from("content")
        .select("id, title, tmdb_id, release_year, rating")
        .eq("type", "tv_show")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!tvErr && tvShows) {
        for (const show of tvShows) {
          if (results.length >= limit) break;
          const { data: missingEps } = await sb.from("episodes")
            .select("season, episode, title")
            .eq("content_id", show["id"])
            .not("embed_link", "is", null)
            .or("sinhala_subtitle_url.is.null,sinhala_subtitle_url.eq.''")
            .limit(5);

          if (missingEps && missingEps.length > 0) {
            results.push({
              id: show["id"] as number,
              title: show["title"] as string,
              type: "tv_show",
              tmdb_id: show["tmdb_id"] as number,
              year: show["release_year"] as number | null,
              rating: show["rating"] as number | null,
              note: `Missing subs for released episode(s): ${missingEps.map((e) => `S${e["season"]}E${e["episode"]}`).join(", ")}`,
            });
          }
        }
      }
    }

    return {
      filter: contentType,
      total_found: results.length,
      explanation: contentType === "movie"
        ? "Showing published movies without Sinhala subtitles."
        : "For TV shows, only released episodes with video are checked. Unreleased/future episodes do not require subtitles until aired.",
      titles: results,
    };
  }

  if (name === "queue_missing_subtitles") {
    const limit = Math.min(Math.max(1, Number(args["limit"] ?? 5)), 15);
    const { data: missing, error } = await sb.from("content")
      .select("id, title, type, tmdb_id")
      .is("sinhala_subtitle_url", null)
      .eq("status", "published")
      .limit(limit);
    if (error) throw new Error(error.message);
    if (!missing || missing.length === 0) return { message: "All published content already has Sinhala subtitles!" };

    const { tmdb } = await import("@/lib/engine.server");
    const queued: Array<{ id: number; title: string; tmdb_id: number; status: string }> = [];

    for (const item of missing) {
      if (!item["tmdb_id"]) continue;
      try {
        const mediaType = item["type"] === "tv_show" ? "tv" : "movie";
        let title = item["title"] as string;
        let releaseDate: string | null = null;
        let popularity = 0;
        let runtime: number | null = null;
        let posterPath: string | null = null;

        if (mediaType === "movie") {
          const d = await tmdb(`/movie/${item["tmdb_id"]}`) as any;
          title = d.title || title;
          releaseDate = d.release_date || null;
          popularity = d.popularity ?? 0;
          runtime = d.runtime ?? null;
          posterPath = d.poster_path ?? null;
        } else {
          const d = await tmdb(`/tv/${item["tmdb_id"]}`) as any;
          title = `${d.name || title} S1E1`;
          releaseDate = d.first_air_date || null;
          popularity = d.popularity ?? 0;
          posterPath = d.poster_path ?? null;
        }

        await sb.from("subtitle_automation_jobs").upsert(
          {
            tmdb_id: item["tmdb_id"],
            media_type: mediaType,
            title,
            season_number: mediaType === "tv" ? 1 : 0,
            episode_number: mediaType === "tv" ? 1 : 0,
            release_date: releaseDate,
            popularity,
            runtime,
            poster_path: posterPath,
            status: "waiting_embed",
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tmdb_id,media_type,season_number,episode_number" },
        );
        queued.push({ id: item["id"], title, tmdb_id: item["tmdb_id"], status: "queued" });
      } catch (err) {
        queued.push({ id: item["id"], title: item["title"], tmdb_id: item["tmdb_id"], status: `failed: ${(err as Error).message}` });
      }
    }

    return { total_queued: queued.length, queued };
  }

  if (name === "manage_announcement") {
    const action = String(args["action"] ?? "get");
    if (action === "get") {
      const { data } = await sb.from("site_settings").select("value").eq("key", "site_announcement").maybeSingle();
      try { return data?.value ? JSON.parse(data.value) : { enabled: false, message: "" }; }
      catch { return { enabled: false, message: data?.value ?? "" }; }
    }
    if (action === "disable") {
      await sb.from("site_settings").upsert({ key: "site_announcement", value: JSON.stringify({ enabled: false, message: "", updated_at: new Date().toISOString() }) }, { onConflict: "key" });
      try { const s = await getSettings(); await revalidateOnflixWeb(s, null, { tmdb_id: 0, media_type: "movie" }); } catch {}
      return { success: true, enabled: false, message: "Announcement disabled" };
    }
    const message = String(args["message"] ?? "").trim();
    const type = String(args["type"] ?? "info");
    const val = { enabled: true, message, type, updated_at: new Date().toISOString() };
    await sb.from("site_settings").upsert({ key: "site_announcement", value: JSON.stringify(val) }, { onConflict: "key" });
    try { const s = await getSettings(); await revalidateOnflixWeb(s, null, { tmdb_id: 0, media_type: "movie" }); } catch {}
    return { success: true, ...val };
  }

  if (name === "manage_glossary") {
    const action = String(args["action"] ?? "list");
    const { data } = await sb.from("site_settings").select("value").eq("key", "sinhala_glossary").maybeSingle();
    let glossary: Record<string, string> = {};
    try { glossary = data?.value ? JSON.parse(data.value) : {}; } catch {}

    if (action === "list") {
      return { total_terms: Object.keys(glossary).length, terms: glossary };
    }
    if (action === "add") {
      const en = String(args["english"] ?? "").trim();
      const si = String(args["sinhala"] ?? "").trim();
      if (!en || !si) throw new Error("Both english and sinhala are required to add a glossary term");
      glossary[en] = si;
      await sb.from("site_settings").upsert({ key: "sinhala_glossary", value: JSON.stringify(glossary), updated_at: new Date().toISOString() }, { onConflict: "key" });
      return { success: true, added: { [en]: si }, total_terms: Object.keys(glossary).length };
    }
    if (action === "remove") {
      const en = String(args["english"] ?? "").trim();
      delete glossary[en];
      await sb.from("site_settings").upsert({ key: "sinhala_glossary", value: JSON.stringify(glossary), updated_at: new Date().toISOString() }, { onConflict: "key" });
      return { success: true, removed: en, total_terms: Object.keys(glossary).length };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── Multi-Provider AI Fallback Engine (Groq -> GitHub Models -> OpenRouter) ─
type ProviderConfig = {
  name: string;
  endpoint: string;
  getKey: () => string | undefined;
  models: readonly string[];
  extraHeaders?: Record<string, string>;
};

const PROVIDERS: ProviderConfig[] = [
  {
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    getKey: () => process.env["GROQ_API_KEY"],
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  },
  {
    name: "GitHub Models",
    endpoint: "https://models.inference.ai.azure.com/chat/completions",
    getKey: () => process.env["GITHUB_TOKEN"] || process.env["GITHUB_PAT"],
    models: ["gpt-4o-mini", "gpt-4o", "meta-llama-3.1-70b-instruct"],
  },
  {
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    getKey: () => process.env["OPENROUTER_API_KEY"],
    models: ["meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-4o-mini", "google/gemini-2.0-flash-001"],
    extraHeaders: {
      "HTTP-Referer": "https://onflixlk.vercel.app",
      "X-Title": "OnFlix Co-Pilot",
    },
  },
];

type ProviderChatResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
    finish_reason: string;
  }>;
};

async function callAIWithFailover(
  groqMessages: unknown[],
  tools: readonly unknown[],
): Promise<ProviderChatResponse> {
  const activeProviders = PROVIDERS.filter((p) => Boolean(p.getKey()?.trim()));

  if (activeProviders.length === 0) {
    throw new Error(
      "No AI API keys configured. Set GROQ_API_KEY, GITHUB_TOKEN, or OPENROUTER_API_KEY in .env.",
    );
  }

  const errors: string[] = [];

  for (const provider of activeProviders) {
    const key = provider.getKey()!.trim();

    for (const model of provider.models) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(provider.extraHeaders ?? {}),
        };

        const res = await fetch(provider.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: groqMessages,
            tools,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 1024,
          }),
        });

        if (res.ok) {
          return (await res.json()) as ProviderChatResponse;
        }

        const errText = await res.text();
        errors.push(`[${provider.name}:${model}] ${res.status}: ${errText.slice(0, 150)}`);

        // If 429 rate-limited on this model, continue to next model/provider immediately
        if (res.status === 429) {
          continue;
        }
      } catch (err) {
        errors.push(`[${provider.name}:${model}] ${(err as Error).message}`);
      }
    }
  }

  throw new Error(
    `All AI providers exhausted. ${errors[errors.length - 1] ?? "Please retry in a few seconds."}`,
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handle(request: Request) {
  const { checkSecret } = await import("@/lib/engine.server");

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await request.json()); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  if (!checkSecret(body.key)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasAnyKey = PROVIDERS.some((p) => Boolean(p.getKey()?.trim()));
  if (!hasAnyKey) {
    return Response.json({ error: "No AI provider keys (GROQ_API_KEY, GITHUB_TOKEN, OPENROUTER_API_KEY) configured" }, { status: 503 });
  }

  const SYSTEM_PROMPT = `You are OnFlix Co-Pilot, the comprehensive AI operations assistant for the OnFlix streaming platform.
You have FULL authority and capability to:
1. Content Library: Search by title, internal ID, or TMDB ID; change publish status (published/draft/archived); delete titles.
2. TMDB & Queueing: Search TMDB by name or ID (search_tmdb); add and queue new movies or TV shows for automation (queue_title).
   - If the user provides a TMDB ID and says "danna", "add karanna", "queue karanna", or asks to add/queue it (e.g. "tmdb id ek me thiyen film ek danna 22349329"), you MUST immediately use the 'queue_title' tool with that tmdb_id! Do NOT just search local content and say it doesn't exist.
3. Homepage Curation:
   - Manually set or view Top 10 lists (get_top_ten, set_top_ten).
   - Auto-curate Top 10 by rating or latest releases (auto_curate_top_ten).
   - Manage Hero Slider manually (get_featured, set_featured) or automatically (auto_curate_hero_slider).
4. System & Quality Health:
   - Run a full platform health audit report (get_health_report).
   - Check which titles lack Sinhala subtitles (get_missing_subtitles) and queue them (queue_missing_subtitles).
   - IMPORTANT SUBTITLE ARCHITECTURE:
     * Movies ('type': 'movie'): Subtitle is stored directly in 'content.sinhala_subtitle_url'. If null, the movie is missing subtitles.
     * TV Shows ('type': 'tv_show'): Subtitles are stored per-episode in the 'episodes' table ('episodes.sinhala_subtitle_url').
     * TV Episodes Reality: TV Shows often list future/upcoming episodes from TMDB that have NOT aired or released yet. In OnFlix, subtitles are only added for released episodes with playable video. Future/unreleased episodes do NOT count as missing subtitles!
     * When user asks "Subtitles නැති films මොනවද" or about movies, set content_type: "movie" and do NOT include TV shows. If all movies have subtitles, state that clearly in Sinhala.
   - Check broken or missing video embed links via EmbedMaster (check_embed_health).
5. User Requests: View pending requests (get_pending_requests), update status (update_user_request_status), or batch fulfill/queue them (auto_fulfill_requests).
6. Sitewide Announcements: View, publish, or disable announcement banners on the website (manage_announcement).
7. Subtitle Glossary: Manage custom Sinhala translation terminology, names, and slang (manage_glossary).

CRITICAL LANGUAGE & COMMUNICATION RULES:
- LANGUAGE ADAPTATION:
  * If the user asks in Sinhala (සිංහල අකුරු) OR Singlish (Sinhala written in English letters, such as "danna", "monawada", "mokakda", "karanna", "thiyenne", "sub missing", "ai mehema", "film ek danna"), you MUST ALWAYS RESPOND IN NATURAL, POLITE SPOKEN SINHALA (සිංහල භාෂාවෙන්).
  * If the user writes in English, reply in English.
- TECHNICAL TERMS & MOVIE TITLES IN ENGLISH:
  * Difficult or technical words MUST stay in English for clarity: 'TMDB ID', 'Subtitle', 'Embed', 'Hero Slider', 'Top 10', 'Queue', 'Cache', 'Revalidate', 'Database', 'Status', 'Draft', 'Published', 'Job', 'API', 'Automation', 'Report'.
  * Film and TV show titles MUST ALWAYS remain in their original English names (e.g., 'Godzilla Minus One', 'The Bad Guys', 'Doctor X', 'Hope', 'Final Table').
- CLEAN MARKDOWN FORMATTING:
  * Present lists and tables cleanly using Markdown.
  * Be concise, direct, helpful, and professional.

Always use tools to fetch real data before answering. When updating data, confirm what was changed clearly.
Current time: ${new Date().toISOString()}`;

  // Keep only the last 8 messages to prevent token accumulation and TPM 429
  const recentMessages = body.messages.slice(-8);

  const groqMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
  ];

  // Agentic loop — up to 6 rounds to handle chained tool calls
  for (let round = 0; round < 6; round++) {
    let groqData: ProviderChatResponse;
    try {
      groqData = await callAIWithFailover(groqMessages, TOOLS);
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 429 });
    }

    const choice = groqData.choices[0];
    if (!choice) return Response.json({ error: "No response from AI provider" }, { status: 502 });

    const assistantMsg = choice.message;
    groqMessages.push(assistantMsg as typeof groqMessages[number]);

    // If no tool calls or done, return final message
    if (!assistantMsg.tool_calls?.length || choice.finish_reason === "stop") {
      return Response.json({
        role: "assistant",
        content: assistantMsg.content ?? "",
        tool_results: [],
      });
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      assistantMsg.tool_calls.map(async (tc) => {
        let result: unknown;
        let isError = false;
        try {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          result = await executeTool(tc.function.name, args);
        } catch (err) {
          result = { error: (err as Error).message };
          isError = true;
        }
        return {
          tool_call_id: tc.id,
          name: tc.function.name,
          result,
          isError,
        };
      }),
    );

    // Add tool results to message history
    for (const tr of toolResults) {
      groqMessages.push({
        role: "tool",
        tool_call_id: tr.tool_call_id,
        content: JSON.stringify(tr.result),
      } as typeof groqMessages[number]);
    }

    // If last round, return current state
    if (round === 5) {
      return Response.json({
        role: "assistant",
        content: "Tool execution limit reached.",
        tool_results: toolResults,
      });
    }
  }

  return Response.json({ error: "Unexpected end of agentic loop" }, { status: 500 });
}

export const Route = createFileRoute("/api/public/copilot/chat")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
