import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Converts raw PCM 16-bit little-endian audio buffer to WAV buffer with 44-byte RIFF header
 */
function convertPcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  bitsPerSample = 16,
  numChannels = 1
): Buffer {
  // Check if buffer is already a RIFF WAV
  if (
    pcmBuffer.length >= 12 &&
    pcmBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    pcmBuffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return pcmBuffer;
  }

  const dataSize = pcmBuffer.length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8, 4, "ascii");

  // "fmt " subchunk
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" subchunk
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function parseMimeRate(mimeType: string): { sampleRate: number; bitsPerSample: number } {
  let sampleRate = 24000;
  let bitsPerSample = 16;

  const parts = mimeType.split(";");
  for (const p of parts) {
    const trimmed = p.trim().toLowerCase();
    if (trimmed.startsWith("rate=")) {
      const parsed = parseInt(trimmed.split("=")[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        sampleRate = parsed;
      }
    } else if (trimmed.startsWith("audio/l")) {
      const parsed = parseInt(trimmed.replace("audio/l", ""), 10);
      if (!isNaN(parsed) && parsed > 0) {
        bitsPerSample = parsed;
      }
    }
  }

  return { sampleRate, bitsPerSample };
}

/**
 * Extracts raw PCM bytes by stripping WAV/RIFF headers if present
 */
function extractRawPcm(buffer: Buffer): Buffer {
  if (
    buffer.length >= 44 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    // Search for 'data' chunk identifier
    const dataIdx = buffer.indexOf("data", 12);
    if (dataIdx !== -1 && dataIdx + 8 <= buffer.length) {
      const dataSize = buffer.readUInt32LE(dataIdx + 4);
      return buffer.subarray(dataIdx + 8, dataIdx + 8 + dataSize);
    }
    return buffer.subarray(44);
  }
  return buffer;
}

/**
 * Splits arbitrary length Arabic/English text into natural, balanced chunks (~1000-1400 chars)
 * for ultra-fast parallel generation and optimal speech cadence.
 */
function splitTextIntoTTSChunks(text: string, maxChunkLength = 1200): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkLength) {
    return [clean];
  }

  // 1. Split into paragraphs
  const paragraphs = clean.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if ((currentChunk ? `${currentChunk}\n${trimmedPara}` : trimmedPara).length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk}\n${trimmedPara}` : trimmedPara;
      continue;
    }

    // 2. Split paragraph by primary punctuation (. ! ? ؟ ؛ :)
    const sentences = trimmedPara.split(/([.!?؟؛:\n]+)/);
    for (let i = 0; i < sentences.length; i += 2) {
      const sentenceText = sentences[i] || "";
      const delimiter = sentences[i + 1] || "";
      const sentence = (sentenceText + delimiter).trim();
      if (!sentence) continue;

      if ((currentChunk ? `${currentChunk} ${sentence}` : sentence).length <= maxChunkLength) {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        // 3. Split by secondary punctuation (، , - —)
        if (sentence.length > maxChunkLength) {
          const subParts = sentence.split(/([،,\-—]+)/);
          for (let j = 0; j < subParts.length; j += 2) {
            const subText = subParts[j] || "";
            const subDelim = subParts[j + 1] || "";
            const subItem = (subText + subDelim).trim();
            if (!subItem) continue;

            if ((currentChunk ? `${currentChunk} ${subItem}` : subItem).length <= maxChunkLength) {
              currentChunk = currentChunk ? `${currentChunk} ${subItem}` : subItem;
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = "";

              // 4. Split by individual words
              if (subItem.length > maxChunkLength) {
                const words = subItem.split(/\s+/);
                for (const word of words) {
                  if ((currentChunk ? `${currentChunk} ${word}` : word).length <= maxChunkLength) {
                    currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
                  } else {
                    if (currentChunk) chunks.push(currentChunk);
                    // 5. Hard slice if single word exceeds limit
                    if (word.length > maxChunkLength) {
                      for (let k = 0; k < word.length; k += maxChunkLength) {
                        chunks.push(word.slice(k, k + maxChunkLength));
                      }
                      currentChunk = "";
                    } else {
                      currentChunk = word;
                    }
                  }
                }
              } else {
                currentChunk = subItem;
              }
            }
          }
        } else {
          currentChunk = sentence;
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

function isQuotaOrRateLimitError(err: any): boolean {
  const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err || "");
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("rate-limits") ||
    msg.includes("rate limit")
  );
}

function extractRateLimitWaitSeconds(err: any): number {
  try {
    const str = typeof err === "string" ? err : JSON.stringify(err || "");
    const match = str.match(/retry in ([0-9.]+)\s*s/i) || str.match(/retryDelay"?:\s*"(\d+)s"/i);
    if (match && match[1]) {
      return Math.ceil(parseFloat(match[1]));
    }
  } catch {}
  return 8;
}

interface CacheEntry {
  audioBase64: string;
  duration: number;
  sampleRate: number;
  chunksCount: number;
  timestamp: number;
}
const ttsCache = new Map<string, CacheEntry>();
const chunkPcmCache = new Map<string, Buffer>();

let geminiQuotaCooldownUntil = 0;

/**
 * Concurrently executes an async function over items with a concurrency pool
 */
async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * High-Speed Synthesis of a single chunk with retry and caching
 */
async function synthesizeSingleChunk(
  ai: GoogleGenAI,
  text: string,
  voice: string
): Promise<Buffer> {
  const cacheKey = `${voice}:${text}`;
  const cached = chunkPcmCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        config: {
          temperature: 0.2,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice || "Zephyr",
              },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      let rawBase64 = "";

      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            rawBase64 = part.inlineData.data;
            break;
          }
        }
      }

      if (rawBase64) {
        const rawBuffer = Buffer.from(rawBase64, "base64");
        const pcmBuffer = extractRawPcm(rawBuffer);

        chunkPcmCache.set(cacheKey, pcmBuffer);
        if (chunkPcmCache.size > 200) {
          const firstKey = chunkPcmCache.keys().next().value;
          if (firstKey) chunkPcmCache.delete(firstKey);
        }

        return pcmBuffer;
      }
      throw new Error("لم يتم استلام بيانات صوتية من النموذج للمقطع.");
    } catch (err: any) {
      console.error(`Error in chunk attempt ${attempts}:`, err?.message || err);
      if (isQuotaOrRateLimitError(err)) {
        if (attempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        const waitSec = Math.max(20, extractRateLimitWaitSeconds(err));
        geminiQuotaCooldownUntil = Date.now() + waitSec * 1000;
        throw err;
      }
      if (attempts >= 3) throw err;
    }
  }

  throw new Error("تعذر توليد صوت المقطع بعد عدة محاولات.");
}

// Health endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint to verify custom Gemini API key
app.post("/api/verify-key", async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return res.status(400).json({ valid: false, error: "يرجى إدخال مفتاح API صحيح." });
    }

    const testAi = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    // Test a lightweight prompt with the Gemini TTS model to verify key validity and quotas
    const response = await testAi.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: "اختبار" }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
      },
    });

    const hasAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (hasAudio) {
      return res.json({ valid: true });
    }

    return res.json({ valid: true });
  } catch (error: any) {
    console.error("API Key Verification Error:", error?.message || error);
    let userMsg = "المفتاح غير صالح أو لا يملك صلاحية الوصول إلى نموذج Gemini TTS.";
    const errMsg = error?.message || "";
    if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("leaked") || errMsg.includes("API key not valid")) {
      userMsg = "تم رفض المفتاح من Google (قد يكون غير صالح أو تم الإبلاغ عنه كمفتاح مسرب). يرجى إنشاء مفتاح جديد.";
    } else if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
      userMsg = "المفتاح صالح، ولكنه تجاوز حد الطلبات المؤقت (Quota Limit). يرجى الانتظار ثوانٍ أو استخدام حساب به حصة نشطة.";
    }
    return res.status(400).json({ valid: false, error: userMsg });
  }
});

// TTS Generation API (Ultra-fast direct synthesis with smart cache, parallel chunking and seamless merging)
app.post("/api/tts", async (req: Request, res: Response) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const { text, voice = "Zephyr" } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "يرجى كتابة نص لتوليد الصوت." });
    }

    const trimmedText = text.trim();

    // Check full in-memory cache for instant response (< 5ms)
    const fullCacheKey = `${voice}:${trimmedText}`;
    const cached = ttsCache.get(fullCacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return res.json({
        success: true,
        audioBase64: cached.audioBase64,
        mimeType: "audio/wav",
        duration: cached.duration,
        voice: voice || "Zephyr",
        chunksCount: cached.chunksCount,
        sampleRate: cached.sampleRate,
        cached: true,
        engine: "gemini",
      });
    }

    const ai = getGeminiClient(customKey);

    // If using shared key and cooldown is active
    if (!customKey && Date.now() < geminiQuotaCooldownUntil) {
      const waitSec = Math.max(1, Math.ceil((geminiQuotaCooldownUntil - Date.now()) / 1000));
      return res.status(429).json({
        success: false,
        isQuotaExceeded: true,
        waitSeconds: waitSec,
        error: `نموذج الذكاء الاصطناعي يخضع لحد الاستخدام المجاني المؤقت (Rate Limit). يرجى الانتظار ${waitSec} ثانية أو إضافة مفتاحك الخاص من أيقونة الترس ⚙️.`,
      });
    }

    // Split text into natural, balanced chunks (~1200 characters each)
    const chunks = splitTextIntoTTSChunks(trimmedText, 1200);

    let mergedPcm: Buffer;
    const sampleRate = 24000;
    const bitsPerSample = 16;

    if (chunks.length === 1) {
      // Single chunk fast path
      mergedPcm = await synthesizeSingleChunk(ai, chunks[0], voice);
    } else {
      // Multi-chunk ultra-fast parallel generation (concurrency of 4)
      const pcmList = await runConcurrent(
        chunks,
        async (chunkText) => {
          return await synthesizeSingleChunk(ai, chunkText, voice);
        },
        4
      );

      // Seamlessly combine PCM buffers in exact order
      mergedPcm = Buffer.concat(pcmList);
    }

    // Generate RIFF WAV with exact duration calculations
    const wavBuffer = convertPcmToWav(mergedPcm, sampleRate, bitsPerSample, 1);
    const wavBase64 = wavBuffer.toString("base64");
    const durationSeconds = mergedPcm.length / (sampleRate * (bitsPerSample / 8));
    const finalDuration = Math.round(durationSeconds * 100) / 100;

    // Save in full cache
    ttsCache.set(fullCacheKey, {
      audioBase64: wavBase64,
      duration: finalDuration,
      sampleRate,
      chunksCount: chunks.length,
      timestamp: Date.now(),
    });

    if (ttsCache.size > 80) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }

    return res.json({
      success: true,
      audioBase64: wavBase64,
      mimeType: "audio/wav",
      duration: finalDuration,
      voice: voice || "Zephyr",
      chunksCount: chunks.length,
      sampleRate,
      engine: "gemini",
    });
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    let errMsg = error?.message || "تعذر إكمال توليد الصوت من نموذج Gemini. يرجى المحاولة مرة أخرى.";
    let waitSec: number | undefined;

    if (isQuotaOrRateLimitError(error)) {
      waitSec = Math.max(15, extractRateLimitWaitSeconds(error));
      geminiQuotaCooldownUntil = Date.now() + waitSec * 1000;
      errMsg = `تم الوصول لحد الاستخدام المؤقت. يرجى الانتظار ${waitSec} ثانية أو استخدام مفتاحك الخاص من أيقونة الترس ⚙️.`;
      return res.status(429).json({
        success: false,
        isQuotaExceeded: true,
        waitSeconds: waitSec,
        error: errMsg,
      });
    }

    return res.status(500).json({
      success: false,
      error: errMsg,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
