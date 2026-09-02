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
 * Splits long text into natural sentences/phrases for TTS synthesis
 */
function splitTextIntoTTSChunks(text: string, maxChunkLength = 2800): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkLength) {
    return [clean];
  }

  // Split into paragraphs first
  const paragraphs = clean.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Check if adding this whole paragraph fits
    if ((currentChunk ? `${currentChunk}\n${trimmedPara}` : trimmedPara).length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk}\n${trimmedPara}` : trimmedPara;
      continue;
    }

    // Split paragraph by punctuation: Arabic and Latin delimiters (. ! ? ؟ ؛)
    const sentences = trimmedPara.split(/([.!?؟؛\n]+)/);
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

        // If sentence itself is longer than maxChunkLength, split by commas (، ,)
        if (sentence.length > maxChunkLength) {
          const subParts = sentence.split(/([،,]+)/);
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

              // If still too long, split by individual words
              if (subItem.length > maxChunkLength) {
                const words = subItem.split(/\s+/);
                for (const word of words) {
                  if ((currentChunk ? `${currentChunk} ${word}` : word).length <= maxChunkLength) {
                    currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
                  } else {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = word;
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

  if (currentChunk) {
    chunks.push(currentChunk);
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

let geminiQuotaCooldownUntil = 0;

/**
 * High-Fidelity Speech Synthesis using Gemini 3.1 Flash TTS model
 */
async function synthesizeWithGemini(
  ai: GoogleGenAI,
  text: string,
  voice: string
): Promise<{ buffer: Buffer; sampleRate: number; bitsPerSample: number } | null> {
  // If under rate-limit cooldown, return null to allow fallback
  if (Date.now() < geminiQuotaCooldownUntil) {
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: text }],
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

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    let rawBase64 = "";
    let incomingMime = "audio/l16; rate=24000; channels=1";

    if (parts && parts.length > 0) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          rawBase64 = part.inlineData.data;
          if (part.inlineData.mimeType) {
            incomingMime = part.inlineData.mimeType;
          }
          break;
        }
      }
    }

    if (rawBase64) {
      const rawBuffer = Buffer.from(rawBase64, "base64");
      const { sampleRate, bitsPerSample } = parseMimeRate(incomingMime);
      return { buffer: rawBuffer, sampleRate, bitsPerSample };
    }
  } catch (err: any) {
    console.error("Gemini TTS API error:", err?.message || err);
    if (isQuotaOrRateLimitError(err)) {
      const waitSec = Math.max(30, extractRateLimitWaitSeconds(err));
      geminiQuotaCooldownUntil = Date.now() + waitSec * 1000;
    }
  }

  return null;
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

// TTS Generation API (Ultra-fast direct synthesis with smart cache and chunking)
app.post("/api/tts", async (req: Request, res: Response) => {
  try {
    const customKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
    const { text, voice = "Zephyr" } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "يرجى كتابة نص لتوليد الصوت." });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 5000) {
      return res.status(400).json({
        error: "النص طويل جداً (الحد الأقصى 5,000 حرف). يرجى تقليصه لتوليد الصوت بجودة مثالية.",
      });
    }

    // Check in-memory cache for instant response (< 5ms)
    const cacheKey = `${voice}:${trimmedText}`;
    const cached = ttsCache.get(cacheKey);
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

    // Generate speech using Gemini 3.1 Flash TTS model
    const geminiAudio = await synthesizeWithGemini(ai, trimmedText, voice);

    if (!geminiAudio) {
      const waitSec = Math.max(5, Math.ceil((geminiQuotaCooldownUntil - Date.now()) / 1000));
      return res.status(429).json({
        success: false,
        isQuotaExceeded: true,
        waitSeconds: waitSec,
        error: `تم الوصول لحد الاستخدام المؤقت لنموذج الصوت. يرجى الانتظار ${waitSec} ثانية أو استخدام مفتاحك من أيقونة الترس ⚙️.`,
      });
    }

    const wavBuffer = convertPcmToWav(
      geminiAudio.buffer,
      geminiAudio.sampleRate,
      geminiAudio.bitsPerSample,
      1
    );
    const wavBase64 = wavBuffer.toString("base64");
    const durationSeconds =
      geminiAudio.buffer.length /
      (geminiAudio.sampleRate * (geminiAudio.bitsPerSample / 8));
    const finalDuration = Math.round(durationSeconds * 100) / 100;

    ttsCache.set(cacheKey, {
      audioBase64: wavBase64,
      duration: finalDuration,
      sampleRate: geminiAudio.sampleRate,
      chunksCount: 1,
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
      chunksCount: 1,
      sampleRate: geminiAudio.sampleRate,
      engine: "gemini",
    });
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "تعذر إكمال توليد الصوت من نموذج Gemini. يرجى المحاولة مرة أخرى.",
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
