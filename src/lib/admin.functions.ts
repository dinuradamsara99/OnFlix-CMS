import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const withKey = <T extends z.ZodRawShape>(shape: T) => z.object({ key: z.string().max(500), ...shape });

async function guard(key: string) {
  const e = await import("./engine.server");
  if (!e.checkSecret(key)) throw new Error("Unauthorized: invalid access key");
  return e;
}

export const getEnv = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => (await guard(data.key)).envStatus());

export const getOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const sb = e.db();
    const counts: Record<string, number> = {};
    await Promise.all(
      e.STATUSES.map(async (s) => {
        const { count } = await sb.from("subtitle_automation_jobs").select("id", { count: "exact", head: true }).eq("status", s);
        counts[s] = count ?? 0;
      }),
    );
    counts["total"] = Object.values(counts).reduce((a, b) => a + b, 0);
    return counts;
  });

export const listJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({ status: z.string().max(30), q: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    let q = e.db()
      .from("subtitle_automation_jobs")
      .select("id,tmdb_id,media_type,title,season_number,episode_number,release_date,popularity,status,attempts,next_retry_at,error_log,srt_url,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const t = data.q.trim();
    if (t) q = /^\d+$/.test(t) ? q.eq("tmdb_id", Number(t)) : q.ilike("title", `%${t.replace(/[%,()]/g, "")}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPreview = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const { data: r } = await e.db().from("subtitle_automation_jobs").select("srt_preview").eq("id", data.id).maybeSingle();
    return r?.srt_preview ?? "";
  });

export const retryJob = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    await e.db().from("subtitle_automation_jobs").update({ status: "waiting_embed", attempts: 0, next_retry_at: null }).eq("id", data.id);
    return true;
  });

export const loadSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => (await guard(data.key)).getSettings());

const settingsSchema = z.object({
  minPopularity: z.number().min(0).max(10000),
  minVoteCount: z.number().int().min(0).max(100000),
  minRating: z.number().min(0).max(10),
  minRuntime: z.number().int().min(0).max(600),
  lookaheadDays: z.number().int().min(0).max(365),
  maxBatchSize: z.number().int().min(1).max(50),
  retryHours: z.number().min(0.25).max(720),
  maxAttempts: z.number().int().min(1).max(100),
  embedProbeUrl: z.union([z.literal(""), z.string().url().max(500)]),
  bucket: z.string().min(1).max(63),
  revalidateUrl: z.string().max(500),
  seriesTypeValue: z.string().min(1).max(30),
  myMemoryEmail: z.string().max(200).optional().default(""),
  wyzieApiKey: z.string().max(200).optional().default(""),
  subdlApiKey: z.string().max(200).optional().default(""),
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({ settings: settingsSchema }).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    await e.saveSettings(data.settings);
    return true;
  });

export const scanNow = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const logs: string[] = [];
    try {
      const r = await e.runScan((m) => logs.push(m));
      return { ok: true, logs, summary: r };
    } catch (err) {
      return { ok: false, logs: [...logs, (err as Error).message], summary: null };
    }
  });

export const processNow = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const logs: string[] = [];
    try {
      const r = await e.runProcess((m) => logs.push(m));
      return { ok: true, logs, summary: r };
    } catch (err) {
      return { ok: false, logs: [...logs, (err as Error).message], summary: null };
    }
  });

export const manualProcess = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withKey({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(["movie", "tv"]),
      season: z.number().int().min(0).max(500).optional(),
      episode: z.number().int().min(1).max(5000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const logs: string[] = [];
    try {
      const r = await e.runManual(
        { tmdbId: data.tmdbId, mediaType: data.mediaType, season: data.season, episode: data.episode },
        (m) => { if (!m.startsWith("@@")) logs.push(m); },
      );
      return { ok: r.status === "completed", status: r.status, logs };
    } catch (err) {
      return { ok: false, status: "failed", logs: [...logs, `✗ ${(err as Error).message}`] };
    }
  });

export const tvSeasons = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({ tmdbId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    return e.tvSeasonCounts(data.tmdbId);
  });

export const listUserRequests = createServerFn({ method: "POST" })
  .inputValidator(
    (d) =>
      withKey({
        status: z.string().max(30).optional().default("all"),
        q: z.string().max(200).optional().default(""),
      }).parse(d),
  )
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    let q = e
      .db()
      .from("requests")
      .select("id,title,tmdb_id,type,status,email,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data.status && data.status !== "all") {
      q = q.eq("status", data.status);
    }
    const t = data.q.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.eq("tmdb_id", Number(t));
      } else {
        const clean = t.replace(/[%,()]/g, "");
        q = q.or(`title.ilike.%${clean}%,email.ilike.%${clean}%`);
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Enrich with TMDB metadata (poster, year, rating, overview) in parallel
    const enriched = await Promise.all(
      list.map(async (item) => {
        try {
          const det = await e.tmdb(`/${item.type}/${item.tmdb_id}`, {});
          return {
            ...item,
            poster_path: (det?.poster_path as string | null) ?? null,
            release_date: ((det?.release_date || det?.first_air_date) as string | null) ?? null,
            vote_average: (det?.vote_average as number | null) ?? null,
            overview: (det?.overview as string | null) ?? null,
          };
        } catch {
          return item;
        }
      }),
    );
    return enriched;
  });

export const updateUserRequestStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (d) =>
      withKey({
        id: z.union([z.number().int(), z.string()]),
        status: z.enum(["pending", "approved", "completed", "rejected"]),
      }).parse(d),
  )
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const { error } = await e
      .db()
      .from("requests")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return true;
  });

export const deleteUserRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (d) =>
      withKey({
        id: z.union([z.number().int(), z.string()]),
      }).parse(d),
  )
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const { error } = await e.db().from("requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return true;
  });

export const getPendingRequestsCount = createServerFn({ method: "POST" })
  .inputValidator((d) => withKey({}).parse(d))
  .handler(async ({ data }) => {
    const e = await guard(data.key);
    const { count, error } = await e
      .db()
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) return 0;
    return count ?? 0;
  });

