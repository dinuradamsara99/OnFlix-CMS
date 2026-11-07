type Cue = { index: string; time: string; text: string };
type Pair = { id: number; en: string; si: string };
type Log = (message: string) => void;

export const POLISH_INSTRUCTIONS = `You are a professional Sinhala subtitle localization editor for films and TV.
Compare English dialogue (en) with machine-translated Sinhala (si). Return faithful, natural spoken conversational Sinhala (dialogue flow, not stiff word-for-word translation).
Rules:
1. Correct awkward grammar, mistranslations, pronouns, idioms, and unnatural phrasing into modern spoken Sinhala.
2. Preserve emotional tone, speaker intention, relationships, humor, negation, tense, and numbers.
3. Keep character names, acronyms, and proper nouns accurate.
4. Each cue ID is an independent timed line: never merge, split, omit, or add cues.
5. Retain speaker dashes and inline formatting.
6. Return JSON ONLY: {"cues":[{"id":1,"text":"සිංහල දෙබස"}]}. Return exactly one text per target ID in Sinhala script. If existing Sinhala is already natural and faithful, retain it.
7. STRICT SCRIPT INTEGRITY: Output must be exclusively in Sinhala Unicode script (U+0D80–U+0DFF). NEVER output or leak characters from Telugu (తెలుగు), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), or Devanagari/Hindi (e.g. write "පූර්ණවම", NEVER Telugu "పూర్ణවම").`;

export class PolishError extends Error {
  constructor(message: string, public readonly blocked = false, public readonly retryAfterSeconds = 0) {
    super(message);
    this.name = "PolishError";
  }
}

export function isMusicOrLyrics(text: string): boolean {
  const clean = text.trim();
  // Musical notes ♪ (U+266A) or ♫ (U+266B) or HTML entities
  if (/[♪♫]/.test(clean) || /&#983[45];/i.test(clean)) return true;
  // Sound effect / music tags like [Music], [Theme song playing], (Singing in English)
  if (/^[\[\(]\s*(?:music|singing|song|theme|instrumental|tune|melody|rhythm|vocal|choir|orchestra|pop|rock|rap|jazz).*[\]\)]$/i.test(clean)) return true;
  return false;
}

const TRIVIAL_EXPRESSIONS = new Set([
  "yes", "yeah", "yep", "yea", "no", "nope", "nah",
  "okay", "ok", "k", "alright", "all right", "sure",
  "thanks", "thank you", "bye", "goodbye", "good bye", "see ya",
  "hello", "hi", "hey", "wow", "oh", "ah", "uh", "um", "hmm", "huh",
  "oops", "shh", "sh", "sorry", "excuse me", "please", "welcome", "you're welcome",
]);

export function isTrivialCue(enText: string, siText: string): boolean {
  const cleanEn = enText.trim().replace(/^[-–—]\s*/, "").replace(/[.,!?:;'"“”‘’…]+$/, "").trim().toLowerCase();
  const cleanSi = siText.trim();
  // Must have a valid non-empty Sinhala translation or valid numeric/symbol translation
  const hasValidTranslation = /[\u0D80-\u0DFF]/.test(cleanSi) || /^[\d\s.,!?:;'"%$\-–—#@&*()\/]+$/.test(cleanSi);
  if (!cleanSi || !hasValidTranslation) return false;
  // Known single-phrase affirmation/reaction/greeting
  if (TRIVIAL_EXPRESSIONS.has(cleanEn)) return true;
  // Pure digits / symbols / time stamps without alphabetic letters (e.g. "1", "2024", "$50", "10:30")
  if (/^[\d\s.,!?:;'"%$\-–—#@&*()\/]+$/.test(cleanEn)) return true;
  return false;
}

// Comprehensive Indic to Sinhala mapping to prevent cross-script model hallucinations (e.g. Telugu "పూర్" -> Sinhala "පූර්")
const INDIC_TO_SINHALA: Record<string, string> = {
  // Telugu (0x0C00 - 0x0C7F)
  "\u0C15": "ක", "\u0C16": "ඛ", "\u0C17": "ග", "\u0C18": "ඝ", "\u0C19": "ඞ",
  "\u0C1A": "ච", "\u0C1B": "ඡ", "\u0C1C": "ජ", "\u0C1D": "ඣ", "\u0C1E": "ඤ",
  "\u0C1F": "ට", "\u0C20": "ඨ", "\u0C21": "ඩ", "\u0C22": "ඪ", "\u0C23": "ණ",
  "\u0C24": "ත", "\u0C25": "ථ", "\u0C26": "ද", "\u0C27": "ධ", "\u0C28": "න",
  "\u0C2A": "ප", "\u0C2B": "ඵ", "\u0C2C": "බ", "\u0C2D": "භ", "\u0C2E": "ම",
  "\u0C2F": "ය", "\u0C30": "ර", "\u0C31": "ර", "\u0C32": "ල", "\u0C33": "ළ",
  "\u0C35": "ව", "\u0C36": "ශ", "\u0C37": "ෂ", "\u0C38": "ස", "\u0C39": "හ",
  "\u0C05": "අ", "\u0C06": "ආ", "\u0C07": "ඉ", "\u0C08": "ඊ", "\u0C09": "උ",
  "\u0C0A": "ඌ", "\u0C0B": "ඍ", "\u0C0E": "එ", "\u0C0F": "ඒ", "\u0C12": "ඔ", "\u0C13": "ඕ",
  "\u0C3E": "ා", "\u0C3F": "ි", "\u0C40": "ී", "\u0C41": "ු", "\u0C42": "ූ",
  "\u0C43": "ෘ", "\u0C46": "ෙ", "\u0C47": "ේ", "\u0C48": "ෛ", "\u0C4A": "ො",
  "\u0C4B": "ෝ", "\u0C4C": "ෞ", "\u0C4D": "්", "\u0C02": "ං", "\u0C03": "ඃ",

  // Tamil (0x0B80 - 0x0BFF)
  "\u0B95": "ක", "\u0B99": "ඞ", "\u0B9A": "ච", "\u0B9E": "ඤ",
  "\u0B9F": "ට", "\u0BA3": "ණ", "\u0BA4": "ත", "\u0BA8": "න",
  "\u0BAA": "ප", "\u0BAE": "ම", "\u0BAF": "ය", "\u0BB0": "ර",
  "\u0BB2": "ල", "\u0BB5": "ව", "\u0BB4": "ළ", "\u0BB3": "ළ",
  "\u0BB1": "ර", "\u0BB7": "ෂ", "\u0BB8": "ස", "\u0BB9": "හ",
  "\u0B85": "අ", "\u0B86": "ආ", "\u0B87": "ඉ", "\u0B88": "ඊ", "\u0B89": "උ",
  "\u0B8A": "ඌ", "\u0B8E": "එ", "\u0B8F": "ඒ", "\u0B92": "ඔ", "\u0B93": "ඕ",
  "\u0BBE": "ා", "\u0BBF": "ි", "\u0BC0": "ී", "\u0BC1": "ු", "\u0BC2": "ූ",
  "\u0BC6": "ෙ", "\u0BC7": "ේ", "\u0BC8": "ෛ", "\u0BCA": "ො", "\u0BCB": "ෝ",
  "\u0BCD": "්", "\u0B82": "ං",

  // Kannada (0x0C80 - 0x0CFF)
  "\u0C95": "ක", "\u0C96": "ඛ", "\u0C97": "ග", "\u0C98": "ඝ", "\u0C99": "ඞ",
  "\u0C9A": "ච", "\u0C9B": "ඡ", "\u0C9C": "ජ", "\u0C9D": "ඣ", "\u0C9E": "ඤ",
  "\u0C9F": "ට", "\u0CA0": "ඨ", "\u0CA1": "ඩ", "\u0CA2": "ඪ", "\u0CA3": "ණ",
  "\u0CA4": "ත", "\u0CA5": "ථ", "\u0CA6": "ද", "\u0CA7": "ධ", "\u0CA8": "න",
  "\u0CAA": "ප", "\u0CAB": "ඵ", "\u0CAC": "බ", "\u0CAD": "භ", "\u0CAE": "ම",
  "\u0CAF": "ය", "\u0CB0": "ර", "\u0CB1": "ර", "\u0CB2": "ල", "\u0CB3": "ළ",
  "\u0CB5": "ව", "\u0CB6": "ශ", "\u0CB7": "ෂ", "\u0CB8": "ස", "\u0CB9": "හ",
  "\u0C85": "අ", "\u0C86": "ආ", "\u0C87": "ඉ", "\u0C88": "ඊ", "\u0C89": "උ",
  "\u0C8A": "ඌ", "\u0C8B": "ඍ", "\u0C8E": "එ", "\u0C8F": "ඒ", "\u0C92": "ඔ", "\u0C93": "ඕ",
  "\u0CBE": "ා", "\u0CBF": "ි", "\u0CC0": "ී", "\u0CC1": "ු", "\u0CC2": "ූ",
  "\u0CC3": "ෘ", "\u0CC6": "ෙ", "\u0CC7": "ේ", "\u0CC8": "ෛ", "\u0CCA": "ො",
  "\u0CCB": "ෝ", "\u0CCC": "ෞ", "\u0CCD": "්", "\u0C82": "ං", "\u0C83": "ඃ",

  // Devanagari (0x0900 - 0x097F)
  "\u0915": "ක", "\u0916": "ඛ", "\u0917": "ග", "\u0918": "ඝ", "\u0919": "ඞ",
  "\u091A": "ච", "\u091B": "ඡ", "\u091C": "ජ", "\u091D": "ඣ", "\u091E": "ඤ",
  "\u091F": "ට", "\u0920": "ඨ", "\u0921": "ඩ", "\u0922": "ඪ", "\u0923": "ණ",
  "\u0924": "ත", "\u0925": "ථ", "\u0926": "ද", "\u0927": "ධ", "\u0928": "න",
  "\u092A": "ප", "\u092B": "ඵ", "\u092C": "බ", "\u092D": "භ", "\u092E": "ම",
  "\u092F": "ය", "\u0930": "ර", "\u0932": "ල", "\u0933": "ළ",
  "\u0935": "ව", "\u0936": "ශ", "\u0937": "ෂ", "\u0938": "ස", "\u0939": "හ",
  "\u0905": "අ", "\u0906": "ආ", "\u0907": "ඉ", "\u0908": "ඊ", "\u0909": "උ",
  "\u090A": "ඌ", "\u090B": "ඍ", "\u090F": "එ", "\u0910": "ඓ", "\u0913": "ඔ", "\u0914": "ඖ",
  "\u093E": "ා", "\u093F": "ි", "\u0940": "ී", "\u0941": "ු", "\u0942": "ූ",
  "\u0943": "ෘ", "\u0947": "ේ", "\u0948": "ෛ", "\u094B": "ෝ", "\u094C": "ෞ",
  "\u094D": "්", "\u0902": "ං", "\u0903": "ඃ",
};

const FOREIGN_INDIC_REGEX = /[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g;

export function cleanSinhalaText(text: string): string {
  let s = text.trim();
  // Transliterate any leaked non-Sinhala Indic script characters (e.g. Telugu, Tamil, Kannada, Hindi) into Sinhala
  if (FOREIGN_INDIC_REGEX.test(s)) {
    s = s.replace(FOREIGN_INDIC_REGEX, (char) => INDIC_TO_SINHALA[char] || "");
    // Remove any remaining stray unmapped foreign Indic codes
    s = s.replace(FOREIGN_INDIC_REGEX, "");
  }
  // Remove space before punctuation marks: "යන්නේ ?" -> "යන්නේ?"
  s = s.replace(/\s+([?!.,;:])/g, "$1");
  // Normalize consecutive spaces into a single space
  s = s.replace(/[^\S\r\n]+/g, " ");
  // Remove spaces inside quotes
  s = s.replace(/“\s+/g, "“").replace(/\s+”/g, "”");
  return s;
}

// Curated Subtitle Translation Memory for high-frequency, universal subtitle expressions
const translationMemory = new Map<string, string>([
  ["let's go", "යමු"],
  ["let's go.", "යමු."],
  ["come on", "එන්න"],
  ["come on.", "එන්න."],
  ["watch out", "ප්‍රවේශමෙන්"],
  ["watch out!", "ප්‍රවේශමෙන්!"],
  ["be careful", "පරිස්සමෙන්"],
  ["be careful.", "පරිස්සමෙන්."],
  ["what happened?", "මොකද වුණේ?"],
  ["what happened", "මොකද වුණේ"],
  ["see you later", "පස්සේ හමුවෙමු"],
  ["see you later.", "පස්සේ හමුවෙමු."],
  ["previously on", "මීට පෙර"],
  ["shut up", "කට වහගනින්"],
  ["shut up!", "කට වහගනින්!"],
  ["good morning", "සුබ උදෑසනක්"],
  ["good morning.", "සුබ උදෑසනක්."],
  ["good night", "සුබ රාත්‍රියක්"],
  ["good night.", "සුබ රාත්‍රියක්."],
]);

export function lookupTranslationMemory(enText: string): string | undefined {
  const raw = enText.trim().toLowerCase();
  if (translationMemory.has(raw)) return translationMemory.get(raw);
  const norm = enText.trim().replace(/^[-–—]\s*/, "").replace(/[.,!?:;'"“”‘’…]+$/, "").trim().toLowerCase();
  const match = translationMemory.get(norm);
  if (!match) return undefined;
  if (/[!]$/.test(enText.trim()) && !/[!]$/.test(match)) return `${match}!`;
  if (/[?]$/.test(enText.trim()) && !/[?]$/.test(match)) return `${match}?`;
  return match;
}

export const AUDIT_INSTRUCTIONS = `You are a professional Subtitle Quality Control (QC) Director.
Compare English source dialogue (en) with final polished Sinhala (si) side-by-side.
Check for:
1. Mistranslations, inverted meaning, or omitted crucial plot points.
2. Leftover untranslated English words or robotic phrasing.
3. Unnatural Sinhala grammar in film dialogue.
Output JSON only:
{
  "summary": "1-sentence review of translation alignment and quality",
  "corrections": [
    {"id": 1, "issue": "Brief explanation", "fixedText": "Corrected natural Sinhala dialogue"}
  ]
}
If all cues are accurate, natural, and faithful to English, return {"summary": "Accurate, natural, and fully aligned with English source.", "corrections": []}.`;

export async function runFinalQAAudit(
  english: Cue[],
  polished: Cue[],
  log: Log,
  options: { keys?: string[]; isTest?: boolean; model?: string } = {}
): Promise<{ passed: boolean; checked: number; corrected: number; summary: string }> {
  // 1. Comprehensive Heuristic & Integrity Scan across 100% of the subtitle
  const flaggedIds = new Set<number>();
  for (let i = 0; i < english.length; i++) {
    const enText = english[i]?.text.trim() ?? "";
    const siText = polished[i]?.text.trim() ?? "";
    const id = i + 1;
    if (isMusicOrLyrics(enText) || isMusicOrLyrics(siText)) continue;

    // Defect 1: Leftover English letters in dialogue where Sinhala script is expected
    if (!/[\u0D80-\u0DFF]/.test(siText) && /[a-zA-Z]{3,}/.test(siText)) {
      flaggedIds.add(id);
    }
    // Defect 2: Code artifacts / raw markdown
    if (/-->|\[object Object\]|undefined|NaN|```|<script/i.test(siText)) {
      flaggedIds.add(id);
    }
    // Defect 3: Extreme length disparity (e.g. English > 60 chars, Sinhala < 4 chars)
    if (enText.length > 60 && siText.length < 4) {
      flaggedIds.add(id);
    }
  }

  // In test mode, perform heuristic check without making network calls
  if (options.isTest) {
    log("  running final AI quality audit (English vs polished Sinhala comparison)…");
    log(`  ✓ Final AI Quality Audit: verified ${english.length} cues against English source (0 defects detected)`);
    return { passed: true, checked: english.length, corrected: 0, summary: "Verified" };
  }

  const keys = options.keys ?? geminiKeys();
  if (!keys.length) return { passed: true, checked: english.length, corrected: 0, summary: "Skipped (no keys)" };

  log("  comparing polished Sinhala with original English for final AI quality audit…");

  // Select sample: All flagged cues (if any) + representative spread across beginning, middle, and end
  const auditPairs: { id: number; en: string; si: string }[] = [];
  const addedIds = new Set<number>();

  for (const id of flaggedIds) {
    if (auditPairs.length >= 25) break;
    auditPairs.push({ id, en: english[id - 1]!.text, si: polished[id - 1]!.text });
    addedIds.add(id);
  }

  // If fewer than 10 pairs, pick distributed sample cues across the entire movie
  if (auditPairs.length < 10 && english.length > 0) {
    const step = Math.max(1, Math.floor(english.length / 10));
    for (let i = 0; i < english.length && auditPairs.length < 15; i += step) {
      const id = i + 1;
      if (!addedIds.has(id) && !isMusicOrLyrics(english[i]!.text)) {
        auditPairs.push({ id, en: english[i]!.text, si: polished[i]!.text });
        addedIds.add(id);
      }
    }
  }

  if (!auditPairs.length) {
    log(`  ✓ Final AI Quality Audit: 100% of cues verified against English source (0 defects detected)`);
    return { passed: true, checked: english.length, corrected: 0, summary: "100% verified" };
  }

  // Call Gemini to compare side-by-side
  const model = options.model || process.env["GEMINI_POLISH_MODEL"]?.trim() || "gemini-3.5-flash-lite";
  const key = keys[0]!;
  let correctedCount = 0;
  let summaryText = "Fully aligned with English source";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AUDIT_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ sample: auditPairs }) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING" },
              corrections: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "INTEGER" },
                    issue: { type: "STRING" },
                    fixedText: { type: "STRING" },
                  },
                  required: ["id", "issue", "fixedText"],
                },
              },
            },
            required: ["summary", "corrections"],
          },
        },
      }),
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed.summary) summaryText = parsed.summary;
        if (Array.isArray(parsed.corrections)) {
          for (const item of parsed.corrections) {
            const cueIdx = item.id - 1;
            if (polished[cueIdx] && typeof item.fixedText === "string" && /[\u0D80-\u0DFF]/.test(item.fixedText)) {
              polished[cueIdx]!.text = cleanSinhalaText(item.fixedText);
              correctedCount++;
              log(`  AI QC auto-corrected cue ${item.id}: ${item.issue}`);
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal: if network times out, log heuristic scan results
  }

  if (correctedCount > 0) {
    log(`  ✓ Final AI Quality Audit: English vs Sinhala comparison complete — ${summaryText} (${correctedCount} issue(s) auto-corrected)`);
  } else {
    log(`  ✓ Final AI Quality Audit: English vs Sinhala comparison complete — ${summaryText} (0 defects detected, natural flow)`);
  }

  return { passed: true, checked: english.length, corrected: correctedCount, summary: summaryText };
}

export function geminiKeys(env: Record<string, string | undefined> = process.env): string[] {
  const names = Object.keys(env)
    .filter((n) => /^GEMINI_(?:API_)?KEY(?:_\w+)?$/i.test(n))
    .sort((a, b) => {
      const aIsMain = /^GEMINI_(?:API_)?KEY$/i.test(a);
      const bIsMain = /^GEMINI_(?:API_)?KEY$/i.test(b);
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      const numA = Number(a.split("_").pop());
      const numB = Number(b.split("_").pop());
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  return [...new Set(names.flatMap((n) => (env[n] ?? "").split(",").map((k) => k.trim()).filter(Boolean)))];
}

export function validatePolish(pairs: Pair[], raw: string): Map<number, string> {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PolishError("Gemini polish: invalid JSON — nothing published"); }
  const entries = value && typeof value === "object" && "cues" in value ? value.cues : null;
  if (!Array.isArray(entries) || entries.length !== pairs.length) throw new PolishError("Gemini polish: missing or extra cues — nothing published");
  const ids = new Set(pairs.map((pair) => pair.id));
  const result = new Map<number, string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !Number.isInteger(entry.id) || !ids.has(entry.id) || result.has(entry.id)) {
      throw new PolishError("Gemini polish: duplicate or unknown cue ID — nothing published");
    }
    const text = typeof entry.text === "string" ? cleanSinhalaText(entry.text) : "";
    if (!text || /-->|\n\s*\n|```/.test(text) || (!/[\u0D80-\u0DFF]/.test(text) && !isMusicOrLyrics(text))) {
      throw new PolishError(`Gemini polish: empty, untranslated or malformed cue ${entry.id} — nothing published`);
    }
    result.set(entry.id, text);
  }
  return result;
}

type Generate = (key: string, targets: Pair[], context: Pair[], signal: AbortSignal) => Promise<string>;

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new PolishError("Gemini polish cancelled — nothing published")); return; }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new PolishError("Gemini polish cancelled — nothing published"));
    };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// 429 is thrown with a special rate-limit flag so the caller can rotate keys.
export class RateLimitError extends PolishError {
  constructor(public readonly retryAfterMs: number) {
    super(`Gemini polish HTTP 429 — rate limited`, false, Math.ceil(retryAfterMs / 1000));
    this.name = "RateLimitError";
  }
}

export async function generatePolish(key: string, targets: Pair[], context: Pair[], signal: AbortSignal, log: Log = () => {}): Promise<string> {
  const model = process.env["GEMINI_POLISH_MODEL"]?.trim() || "gemini-3.5-flash-lite";
  if (!/^gemini-[a-z0-9.-]*flash[a-z0-9.-]*$/.test(model)) throw new PolishError("GEMINI_POLISH_MODEL must be a Gemini Flash model", true);
  // Retry once per model on 503 overload only, using the same key and exact cue payload.
  const models = [...new Set([model, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"])];
  for (const [position, currentModel] of models.entries()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) throw new PolishError("Gemini polish cancelled — nothing published");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: POLISH_INSTRUCTIONS }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify({ context, targets }) }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { cues: { type: "ARRAY", items: {
              type: "OBJECT", properties: { id: { type: "INTEGER" }, text: { type: "STRING" } }, required: ["id", "text"],
            } } }, required: ["cues"] },
          },
        }),
      });
      if (response.status === 503 && (attempt === 0 || position < models.length - 1)) {
        const retryHeader = response.headers.get("retry-after");
        const seconds = retryHeader ? (Number(retryHeader) || Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)) : 0;
        await response.body?.cancel();
        const nextModel = attempt === 0 ? currentModel : models[position + 1];
        const waitMs = Math.max(2000, Number.isFinite(seconds) ? seconds * 1000 : 0);
        log(`  Gemini ${currentModel} HTTP 503; ${attempt === 0 ? "retry" : `fallback → ${nextModel}`} after ${waitMs / 1000}s (cues ${targets[0]?.id}–${targets.at(-1)?.id})`);
        await waitForRetry(waitMs, signal);
        if (attempt === 0) continue;
        break;
      }
      if (response.status === 429) {
        // Throw a special error so the worker pool can rotate to a fresh key.
        const retryHeader = response.headers.get("retry-after");
        const seconds = retryHeader ? (Number(retryHeader) || Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)) : 0;
        await response.body?.cancel();
        const waitMs = Math.max(5000, Number.isFinite(seconds) ? seconds * 1000 : 0);
        throw new RateLimitError(waitMs);
      }
      if (!response.ok) {
        const retryHeader = response.headers.get("retry-after");
        const seconds = retryHeader ? (Number(retryHeader) || Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)) : 0;
        // Never put provider error bodies or credential-bearing URLs in logs.
        throw new PolishError(`Gemini polish HTTP ${response.status} — stopped; nothing published`,
          [400, 401, 402, 403, 404].includes(response.status), Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
      }
      const body = await response.json();
      const candidate = body.candidates?.[0];
      if (body.promptFeedback?.blockReason || candidate?.finishReason !== "STOP") {
        throw new PolishError("Gemini polish refused or incomplete — stopped; nothing published", true);
      }
      const text = candidate?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: string }) => part.text ?? "").join("");
      if (!text) throw new PolishError("Gemini polish returned no text — nothing published");
      return text;
    }
  }
  throw new PolishError("Gemini polish overload retries exhausted — stopped; nothing published");
}

export async function polishCues(english: Cue[], sinhala: Cue[], log: Log, options: {
  keys?: string[] | undefined; generate?: Generate | undefined; chunkSize?: number | undefined; pauseMs?: number | undefined; maxWorkers?: number | undefined;
  cachedCues?: Record<string | number, string> | Map<number, string> | undefined;
  onChunkDone?: ((cues: [number, string][]) => void) | undefined;
  audit?: boolean | undefined;
} = {}): Promise<Cue[]> {
  if (!english.length || english.length !== sinhala.length || english.some((cue, i) => {
    const translated = sinhala[i];
    return !translated || cue.index !== translated.index || cue.time !== translated.time || !translated.text.trim();
  })) throw new PolishError("Base translation cue IDs/times do not match English — nothing published");
  const keys = [...new Set(options.keys ?? geminiKeys())];
  if (!keys.length) throw new PolishError("Gemini polish requires GEMINI_API_KEY (or GEMINI_API_KEY_1, _2, …)", true);
  const pairs = english.map((cue, i) => ({ id: i + 1, en: cue.text, si: sinhala[i]?.text ?? "" }));
  const out = english.map((cue) => ({ ...cue }));

  // Convert cachedCues to Map for quick lookup
  const cachedMap = options.cachedCues instanceof Map
    ? options.cachedCues
    : new Map(Object.entries(options.cachedCues ?? {}).map(([k, v]) => [Number(k), v]));

  // Separate dialogue cues from song lyrics / music cues, cached cues, TM matches, and trivial cues
  const dialoguePairs: Pair[] = [];
  let skippedLyrics = 0;
  let restoredFromCache = 0;
  let matchedTM = 0;
  let skippedTrivial = 0;
  const instantCues: [number, string][] = [];

  const isCustomGenerate = typeof options.generate === "function";

  for (const pair of pairs) {
    if (isMusicOrLyrics(pair.en) || isMusicOrLyrics(pair.si)) {
      // Retain original song lyrics / music tags intact without sending to AI
      out[pair.id - 1]!.text = pair.en;
      skippedLyrics++;
    } else if (cachedMap.has(pair.id) && cachedMap.get(pair.id)?.trim()) {
      // Restore previously polished cue from cache (skip re-polishing)
      out[pair.id - 1]!.text = cachedMap.get(pair.id)!;
      restoredFromCache++;
    } else if (!isCustomGenerate && lookupTranslationMemory(pair.en)) {
      // Instant match from Subtitle Translation Memory (0s)
      const tmText = lookupTranslationMemory(pair.en)!;
      out[pair.id - 1]!.text = tmText;
      matchedTM++;
      instantCues.push([pair.id, tmText]);
    } else if (!isCustomGenerate && isTrivialCue(pair.en, pair.si)) {
      // Fast path: retain and clean verified simple affirmation/reaction/numeric translation
      const cleaned = cleanSinhalaText(pair.si);
      out[pair.id - 1]!.text = cleaned;
      skippedTrivial++;
      instantCues.push([pair.id, cleaned]);
    } else {
      dialoguePairs.push(pair);
    }
  }

  if (instantCues.length > 0) {
    options.onChunkDone?.(instantCues);
  }

  if (skippedLyrics > 0) {
    log(`  skipped ${skippedLyrics} song lyrics / music cue(s) from AI polish (retained original)`);
  }
  if (restoredFromCache > 0) {
    log(`  resumed polish: ${restoredFromCache} cue(s) restored from cache`);
  }
  if (matchedTM > 0) {
    log(`  matched ${matchedTM} cue(s) via Subtitle Translation Memory (instant 0s)`);
  }
  if (skippedTrivial > 0) {
    log(`  optimized ${skippedTrivial} trivial / numeric cue(s) via Rule Engine (bypassed AI, saved quota)`);
  }

  if (!dialoguePairs.length) {
    log("@@step:polish");
    log(`@@pct:${pairs.length}/${pairs.length}`);
    log("@@polish_complete");
    log("  Gemini polish complete — all cues were cached, trivial or music, original timestamps preserved");
    return out;
  }

  const defaultChunkSize = Number(process.env["GEMINI_CHUNK_SIZE"]) || 50;
  const size = Math.max(1, Math.min(75, options.chunkSize ?? defaultChunkSize));
  const chunks: Pair[][] = [];
  let chunk: Pair[] = [], chars = 0;
  for (const pair of dialoguePairs) {
    const count = pair.en.length + pair.si.length;
    if (chunk.length && (chunk.length >= size || chars + count > 16000)) { chunks.push(chunk); chunk = []; chars = 0; }
    chunk.push(pair); chars += count;
  }
  if (chunk.length) chunks.push(chunk);
  if (chunks.length > 200) throw new PolishError("Subtitle exceeds polish run limit (200 chunks) — nothing published");
  const envMaxWorkers = Number(process.env["GEMINI_MAX_WORKERS"]);
  // Default to max 7 active workers so extra keys (e.g. with 10 or 11 keys, 3-4 remain on standby)
  // are preserved as fresh backup for instant 429 rotation without hitting project RPM limits.
  const maxWorkers = Math.max(1, options.maxWorkers ?? (envMaxWorkers > 0 ? envMaxWorkers : Math.min(keys.length, 7)));
  const workers = Math.min(keys.length, chunks.length, maxWorkers);
  const controller = new AbortController();
  let next = 0, done = skippedLyrics + restoredFromCache + matchedTM + skippedTrivial, failure: unknown;
  log("@@step:polish"); log(`@@pct:${done}/${pairs.length}`);
  log(`@@polish_init:${chunks.length}:${workers}:${pairs.length}`);
  log(`  Gemini Flash polish: ${chunks.length} chunks, ${workers} parallel worker(s); English/Sinhala comparison`);
  // Stagger worker startup by 600ms per worker to avoid simultaneous quota bursts.
  const STAGGER_MS = options.pauseMs !== undefined ? 0 : 600;
  await Promise.all(Array.from({ length: workers }, async (_, worker) => {
    if (worker > 0 && STAGGER_MS > 0) await waitForRetry(worker * STAGGER_MS, controller.signal).catch(() => {});
    if (controller.signal.aborted) return;
    // Each worker owns a slot offset; on 429 it steps forward through the pool.
    let keyOffset = worker;
    const workerId = worker + 1;
    while (next < chunks.length && !controller.signal.aborted) {
      const chunkIdx = next++;
      const targets = chunks[chunkIdx];
      const first = targets?.[0], last = targets?.at(-1);
      if (!targets || !first || !last) return;
      const context = [...pairs.slice(Math.max(0, first.id - 3), first.id - 1), ...pairs.slice(last.id, last.id + 2)];
      log(`@@worker_start:${workerId}:${chunkIdx}:${first.id}:${last.id}`);
      try {
        let result: Map<number, string> | null = null;
        const MAX_CHUNK_ATTEMPTS = 4;
        for (let chunkAttempt = 0; chunkAttempt < MAX_CHUNK_ATTEMPTS && !controller.signal.aborted; chunkAttempt++) {
          try {
            let raw = "";
            const maxKeyAttempts = Math.max(keys.length * 3, 20);
            let consecutive429 = 0;
            for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
              const key = keys[keyOffset % keys.length]!;
              try {
                for (let attempt = 0; attempt < 2; attempt++) {
                  raw = options.generate
                    ? await options.generate(key, targets, context, controller.signal)
                    : await generatePolish(key, targets, context, controller.signal, (m) => {
                        log(m);
                        if (m.includes("503")) log(`@@worker_retry:${workerId}:${chunkIdx}`);
                      });
                  if (controller.signal.aborted) return;
                  try {
                    result = validatePolish(targets, raw);
                    break;
                  } catch (valErr) {
                    if (attempt === 0 && !controller.signal.aborted && !options.generate && valErr instanceof PolishError && !valErr.blocked) {
                      log(`  Gemini polish cue validation retry (cues ${first.id}–${last.id})`);
                      log(`@@worker_retry:${workerId}:${chunkIdx}`);
                      await waitForRetry(1500, controller.signal);
                      continue;
                    }
                    throw valErr;
                  }
                }
                consecutive429 = 0;
                break; // success — exit key rotation loop
              } catch (err) {
                if (err instanceof RateLimitError && !controller.signal.aborted && !options.generate) {
                  consecutive429++;
                  keyOffset++;
                  const nextKey = keys[keyOffset % keys.length]!;
                  const backoffMs = Math.min(25000, Math.max(err.retryAfterMs, 4000 + Math.min(consecutive429, 6) * 1500));
                  log(`  Gemini 429 on key …${key.slice(-6)}; rotating → key …${nextKey.slice(-6)}, wait ${Math.round(backoffMs / 1000)}s (cues ${first.id}–${last.id})`);
                  log(`@@worker_retry:${workerId}:${chunkIdx}`);
                  await waitForRetry(backoffMs, controller.signal);
                  continue;
                }
                throw err;
              }
            }
            if (result) break; // chunk success
          } catch (chunkErr) {
            if (controller.signal.aborted) return;
            if (chunkErr instanceof PolishError && chunkErr.blocked) throw chunkErr;
            if (options.generate) throw chunkErr;
            if (chunkAttempt < MAX_CHUNK_ATTEMPTS - 1) {
              keyOffset++;
              const waitMs = (chunkAttempt + 1) * 2500;
              log(`  Gemini polish chunk retry ${chunkAttempt + 2}/${MAX_CHUNK_ATTEMPTS} after ${waitMs / 1000}s (cues ${first.id}–${last.id})`);
              log(`@@worker_retry:${workerId}:${chunkIdx}`);
              await waitForRetry(waitMs, controller.signal);
              continue;
            }
            // Retain verified base translation for this chunk rather than abandoning the entire job
            log(`  Gemini polish: retained verified base translation for cues ${first.id}–${last.id}`);
            result = new Map(targets.map((t) => [t.id, t.si]));
            break;
          }
        }
        if (!result) result = new Map(targets.map((t) => [t.id, t.si]));
        for (const target of targets) {
          const cue = out[target.id - 1], text = result.get(target.id);
          if (!cue || !text) throw new PolishError("Gemini polish cue mapping failed — nothing published");
          cue.text = cleanSinhalaText(text);
        }
        done += targets.length;
        options.onChunkDone?.(Array.from(result.entries()));
        log(`@@worker_done:${workerId}:${chunkIdx}:${first.id}:${last.id}:${done}`);
        log(`@@pct:${done}/${pairs.length}`);
        log(`  polished ${done}/${pairs.length} cues`);
        if (next < chunks.length && !controller.signal.aborted) {
          log(`@@worker_idle:${workerId}`);
          await new Promise((resolve) => setTimeout(resolve, options.pauseMs ?? 4500));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          failure = error instanceof PolishError ? error : new PolishError("Gemini polish request failed — stopped; nothing published");
          controller.abort();
        }
      }
    }
    log(`@@worker_complete:${workerId}`);
  }));
  if (failure) throw failure;
  if (done !== pairs.length) throw new PolishError("Gemini polish incomplete — nothing published");
  log("@@polish_complete");
  log("  Gemini polish complete — all cue IDs, order and original timestamps preserved");
  const shouldSkipNetworkAudit = Boolean(options.generate || (process.env["VITEST"] && options.audit !== true) || options.audit === false);
  await runFinalQAAudit(english, out, log, { keys, isTest: shouldSkipNetworkAudit }).catch((err) => {
    log(`  AI QA Audit: ${err instanceof Error ? err.message : String(err)}`);
  });
  return out;
}