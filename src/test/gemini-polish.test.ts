import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePolish, geminiKeys, polishCues, PolishError, RateLimitError, validatePolish, isTrivialCue, cleanSinhalaText, lookupTranslationMemory, runFinalQAAudit } from "@/lib/gemini-polish.server";
import { buildSrt, parseSrt } from "@/lib/engine.server";

const en = parseSrt("7\n00:00:01,123 --> 00:00:02,456\nWhere are you going?\n\n9\n00:00:03,111 --> 00:00:04,999\nI need to find him now.\n");
const si = en.map((cue) => ({ ...cue, text: "මම යනවා." }));
const pairs = [{ id: 1, en: "Hello", si: "ආයුබෝවන්" }, { id: 2, en: "Goodbye", si: "ගිහින් එන්නම්" }];

describe("Gemini overload recovery", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const success = () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ cues: pairs.map((p) => ({ id: p.id, text: p.si })) }) }] } }] });
  it("retries the same model after exactly two seconds on 503", async () => {
    vi.useFakeTimers(); vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(async () => success());
    vi.stubGlobal("fetch", fetchMock);
    const pending = generatePolish("test", pairs, [], new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1999); expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await expect(pending).resolves.toContain("ආයුබෝවන්");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(fetchMock.mock.calls[1]?.[0]);
  });
  it("falls back in order to 3.1 Flash Lite then 3.5 Flash without changing key or dialogue payload", async () => {
    vi.useFakeTimers(); vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn().mockImplementation(async () => fetchMock.mock.calls.length <= 4 ? new Response(null, { status: 503 }) : success());
    vi.stubGlobal("fetch", fetchMock);
    const pending = polishCues(en, si, () => {}, { keys: ["test"] });
    await vi.runAllTimersAsync(); const result = await pending;
    expect(fetchMock.mock.calls.map((call) => String(call[0]).split("/models/")[1])).toEqual([
      "gemini-3.5-flash-lite:generateContent", "gemini-3.5-flash-lite:generateContent",
      "gemini-3.1-flash-lite:generateContent", "gemini-3.1-flash-lite:generateContent", "gemini-3.5-flash:generateContent",
    ]);
    expect(new Set(fetchMock.mock.calls.map((call) => JSON.stringify(call[1]))).size).toBe(1);
    expect(result.map(({ index, time }) => ({ index, time }))).toEqual(en.map(({ index, time }) => ({ index, time })));
  });
  it("stops after at most eight overload requests without returning partial text", async () => {
    vi.useFakeTimers(); vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 })); vi.stubGlobal("fetch", fetchMock);
    const assertion = expect(generatePolish("test", pairs, [], new AbortController().signal)).rejects.toThrow("HTTP 503");
    await vi.runAllTimersAsync(); await assertion; expect(fetchMock).toHaveBeenCalledTimes(8);
  });
  it.each([400, 401, 403, 404])("does not switch models or retry on HTTP %s", async (status) => {
    vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn(async () => new Response(null, { status })); vi.stubGlobal("fetch", fetchMock);
    await expect(generatePolish("test", pairs, [], new AbortController().signal)).rejects.toThrow(`HTTP ${status}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("throws RateLimitError (not a hard stop) on HTTP 429 so the caller can rotate keys", async () => {
    vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "10" } }));
    vi.stubGlobal("fetch", fetchMock);
    const err = await generatePolish("test", pairs, [], new AbortController().signal).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBeGreaterThanOrEqual(10000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rotates to the next key on 429 and completes without failure", async () => {
    vi.useFakeTimers(); vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    // Returns a correct response for whatever cue IDs are in the request body.
    const makeSiResponse = (body: string) => {
      try {
        const outer = JSON.parse(body);
        const innerText = outer.contents?.[0]?.parts?.[0]?.text;
        const inner = innerText ? JSON.parse(innerText) : outer;
        const targets = inner.targets ?? pairs;
        return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
          cues: targets.map((t: { id: number }) => ({ id: t.id, text: "සිංහල දෙබස" })),
        }) }] } }] });
      } catch {
        return success();
      }
    };
    const usedKeys: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const usedKey = (init.headers as Record<string, string>)["x-goog-api-key"] ?? "";
      usedKeys.push(usedKey);
      return usedKey === "key-a" ? new Response(null, { status: 429, headers: { "retry-after": "1" } })
        : makeSiResponse(init.body as string);
    });
    vi.stubGlobal("fetch", fetchMock);
    // 1 chunk (2 cues), 2 keys — worker-1 starts on key-a, hits 429, rotates to key-b
    const pending = polishCues(en, si, () => {}, { keys: ["key-a", "key-b"] });
    await vi.runAllTimersAsync();
    await pending;
    // key-b must have been used after key-a was rate-limited
    expect(usedKeys).toContain("key-a");
    expect(usedKeys).toContain("key-b");
    expect(usedKeys.indexOf("key-b")).toBeGreaterThan(usedKeys.indexOf("key-a"));
  });
  it("cancels the two-second wait when another worker stops the run", async () => {
    vi.useFakeTimers(); vi.stubEnv("GEMINI_POLISH_MODEL", "gemini-3.5-flash-lite");
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 })); vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const assertion = expect(generatePolish("test", pairs, [], controller.signal)).rejects.toThrow("cancelled");
    await vi.advanceTimersByTimeAsync(0); controller.abort(); await assertion;
    await vi.runAllTimersAsync(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Gemini subtitle polish", () => {
  it("collects primary, comma-separated and numbered keys in numeric order without duplicates", () => {
    expect(geminiKeys({ GEMINI_API_KEY: "a,b", GEMINI_API_KEY_10: "d", GEMINI_API_KEY_03: "c", GEMINI_API_KEY_1: "b" })).toEqual(["a", "b", "c", "d"]);
  });
  it("preserves exact timestamps, original IDs and order despite reordered AI output", async () => {
    const result = await polishCues(en, si, () => {}, { keys: ["test"], generate: async () => JSON.stringify({ cues: [
      { id: 2, text: "මට දැන්ම එයාව හොයාගන්න ඕනෙ." }, { id: 1, text: "ඔයා කොහෙද යන්නේ?" },
    ] }) });
    expect(result.map(({ index, time }) => ({ index, time }))).toEqual([
      { index: "7", time: "00:00:01,123 --> 00:00:02,456" }, { index: "9", time: "00:00:03,111 --> 00:00:04,999" },
    ]);
    expect(result.map((cue) => cue.text)).toEqual(["ඔයා කොහෙද යන්නේ?", "මට දැන්ම එයාව හොයාගන්න ඕනෙ."]);
    expect(parseSrt(buildSrt(result))).toEqual(result);
    expect(si[0]?.text).toBe("මම යනවා.");
  });
  it("never supplies timestamps to the AI", async () => {
    await polishCues(en, si, () => {}, { keys: ["test"], generate: async (_, targets, context) => {
      expect(JSON.stringify({ targets, context })).not.toContain("00:00:");
      return JSON.stringify({ cues: targets.map((target) => ({ id: target.id, text: target.si })) });
    } });
  });
  it.each([
    ["missing cue", [{ id: 1, text: "හරි" }]],
    ["duplicate cue", [{ id: 1, text: "හරි" }, { id: 1, text: "හරි" }]],
    ["unknown cue", [{ id: 1, text: "හරි" }, { id: 3, text: "හරි" }]],
    ["empty cue", [{ id: 1, text: "හරි" }, { id: 2, text: " " }]],
    ["English-only cue", [{ id: 1, text: "හරි" }, { id: 2, text: "Goodbye" }]],
    ["SRT injection", [{ id: 1, text: "හරි" }, { id: 2, text: "හරි\n00:00:01 --> 00:00:02" }]],
  ])("rejects %s rather than publishing a defective subtitle", (_, cues) => {
    expect(() => validatePolish(pairs, JSON.stringify({ cues }))).toThrow(PolishError);
  });
  it("rejects base translation cue/timestamp mismatch before calling AI", async () => {
    let called = false;
    await expect(polishCues(en, [{ ...si[0], index: "7", time: "changed", text: "හරි" }, si[1] as typeof en[number]], () => {}, {
      keys: ["test"], generate: async () => { called = true; return ""; },
    })).rejects.toThrow("do not match");
    expect(called).toBe(false);
  });
  it("runs chunks in parallel on different keys and reconstructs by ID", async () => {
    let active = 0, peak = 0;
    const used = new Set<string>();
    const result = await polishCues(en, si, () => {}, { keys: ["a", "b"], chunkSize: 1, pauseMs: 0,
      generate: async (key, targets) => {
        used.add(key); active++; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, key === "a" ? 10 : 1)); active--;
        return JSON.stringify({ cues: targets.map((target) => ({ id: target.id, text: target.id === 1 ? "ඔයා කොහෙද යන්නේ?" : "මට එයාව හොයාගන්න ඕනෙ." })) });
      },
    });
    expect(peak).toBe(2); expect([...used]).toEqual(["a", "b"]);
    expect(result.map((cue) => cue.index)).toEqual(["7", "9"]);
  });
  it("scales up to 7 workers when 7 keys are provided", async () => {
    let active = 0, peak = 0;
    const testKeys = ["k1", "k2", "k3", "k4", "k5", "k6", "k7"];
    const testEn = Array.from({ length: 7 }, (_, i) => ({ index: String(i + 1), time: `00:00:0${i},000 --> 00:00:0${i},999`, text: `Line ${i + 1}` }));
    const testSi = testEn.map((cue) => ({ ...cue, text: "සිංහල" }));
    await polishCues(testEn, testSi, () => {}, {
      keys: testKeys, chunkSize: 1, pauseMs: 0,
      generate: async (_, targets) => {
        active++; peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 15)); active--;
        return JSON.stringify({ cues: targets.map((t) => ({ id: t.id, text: "සිංහල දෙබස" })) });
      },
    });
    expect(peak).toBe(7);
  });
  it("halts on denial without switching credentials or publishing partial work", async () => {
    let calls = 0;
    await expect(polishCues(en, si, () => {}, { keys: ["a", "b"], chunkSize: 1,
      generate: async () => { calls++; throw new PolishError("denied", true); },
    })).rejects.toThrow("denied");
    expect(calls).toBeLessThanOrEqual(2);
  });
  it("skips song lyrics and music cues from AI polish, keeping original lyrics with music notes intact", async () => {
    const mixedEn = [
      { index: "1", time: "00:00:01,000 --> 00:00:02,000", text: "♪ Never gonna give you up ♪" },
      { index: "2", time: "00:00:03,000 --> 00:00:04,000", text: "Where are you going?" },
      { index: "3", time: "00:00:05,000 --> 00:00:06,000", text: "[Theme song playing]" },
    ];
    const mixedSi = [
      { index: "1", time: "00:00:01,000 --> 00:00:02,000", text: "♪ ඔයාව අත්හරින්නේ නෑ ♪" },
      { index: "2", time: "00:00:03,000 --> 00:00:04,000", text: "ඔබ කොහෙද යන්නේ?" },
      { index: "3", time: "00:00:05,000 --> 00:00:06,000", text: "[තේමා ගීතය වාදනය වේ]" },
    ];
    const generatedTargets: number[] = [];
    const result = await polishCues(mixedEn, mixedSi, () => {}, {
      keys: ["test"],
      generate: async (_, targets) => {
        generatedTargets.push(...targets.map((t) => t.id));
        return JSON.stringify({ cues: targets.map((t) => ({ id: t.id, text: "කොහෙද යන්නේ?" })) });
      },
    });
    // AI should ONLY have been called for cue 2 (dialogue), skipping cues 1 and 3 (music/lyrics)
    expect(generatedTargets).toEqual([2]);
    expect(result[0]?.text).toBe("♪ Never gonna give you up ♪");
    expect(result[1]?.text).toBe("කොහෙද යන්නේ?");
    expect(result[2]?.text).toBe("[Theme song playing]");
  });

  describe("advanced optimization engine", () => {
    it("identifies trivial affirmations, reactions, and numbers for AI bypass", () => {
      expect(isTrivialCue("Yes.", "ඔව්.")).toBe(true);
      expect(isTrivialCue("No!", "නැහැ!")).toBe(true);
      expect(isTrivialCue("Okay", "හරි")).toBe(true);
      expect(isTrivialCue("Thank you.", "ස්තූතියි.")).toBe(true);
      expect(isTrivialCue("100%", "100%")).toBe(true);
      expect(isTrivialCue("2024", "2024")).toBe(true);
      expect(isTrivialCue("Where did he go yesterday?", "ඔහු ඊයේ ගියේ කොහේද?")).toBe(false);
      expect(isTrivialCue("Yes", "")).toBe(false); // empty Sinhala should not bypass
    });

    it("normalizes punctuation and spaces in Sinhala text", () => {
      expect(cleanSinhalaText("කොහෙද යන්නේ ?")).toBe("කොහෙද යන්නේ?");
      expect(cleanSinhalaText("හරි  මම   යන්නම් .")).toBe("හරි මම යන්නම්.");
      expect(cleanSinhalaText("పూర్ණවම වෙනස් ආකෘතියක්")).toBe("පූර්ණවම වෙනස් ආකෘතියක්");
    });

    it("matches universal expressions from Translation Memory", () => {
      expect(lookupTranslationMemory("Let's go!")).toBe("යමු!");
      expect(lookupTranslationMemory("Come on.")).toBe("එන්න.");
      expect(lookupTranslationMemory("Watch out!")).toBe("ප්‍රවේශමෙන්!");
      expect(lookupTranslationMemory("Previously on...")).toBe("මීට පෙර");
      expect(lookupTranslationMemory("Random unfamiliar dialogue line")).toBeUndefined();
    });

    it("runs final QA comparison audit and detects potential cue anomalies", async () => {
      const logs: string[] = [];
      const testEn = [
        { index: "1", time: "00:00:01,000 --> 00:00:02,000", text: "Where are you going?" },
        { index: "2", time: "00:00:03,000 --> 00:00:04,000", text: "I am going home." },
      ];
      const testSi = [
        { index: "1", time: "00:00:01,000 --> 00:00:02,000", text: "ඔයා කොහෙද යන්නේ?" },
        { index: "2", time: "00:00:03,000 --> 00:00:04,000", text: "මම ගෙදර යනවා." },
      ];
      const audit = await runFinalQAAudit(testEn, testSi, (m) => logs.push(m), { isTest: true });
      expect(audit.passed).toBe(true);
      expect(audit.checked).toBe(2);
      expect(logs.some((l) => l.includes("Final AI Quality Audit"))).toBe(true);
    });
  });
});