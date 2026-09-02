/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Eraser,
  X,
  Settings,
  KeyRound,
} from 'lucide-react';
import { AudioPlayer } from './components/AudioPlayer';
import { SettingsModal } from './components/SettingsModal';
import { TTSResponse } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [text, setText] = useState('');
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_custom_api_key') || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [chunksCount, setChunksCount] = useState<number>(1);
  const [currentEngine, setCurrentEngine] = useState<string>('gemini');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Save key to localStorage
  const handleSaveApiKey = (newKey: string) => {
    setCustomApiKey(newKey);
    if (newKey) {
      localStorage.setItem('gemini_custom_api_key', newKey);
    } else {
      localStorage.removeItem('gemini_custom_api_key');
    }
  };

  // Start with empty text
  useEffect(() => {
    setText('');
  }, []);

  // Countdown timer for rate limits if any
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  const handleGenerateAudio = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage('يرجى كتابة نص أولاً للتمكن من تحويله إلى صوت.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-gemini-api-key': customApiKey } : {}),
        },
        body: JSON.stringify({
          text: trimmed,
          apiKey: customApiKey || undefined,
        }),
      });

      const data: TTSResponse = await res.json();

      if (data.isQuotaExceeded && data.waitSeconds) {
        setCountdown(data.waitSeconds);
        setErrorMessage(data.error || `يرجى الانتظار ${data.waitSeconds} ثانية للمحاولة مجدداً.`);
        return;
      }

      if (!res.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'تعذر توليد الصوت من النموذج. يرجى المحاولة مرة أخرى.');
      }

      // Successful audio generation from model
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const mime = data.mimeType || 'audio/wav';
      const audioBlob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(audioBlob);

      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }

      setCurrentAudioUrl(url);
      setCurrentBlob(audioBlob);
      setAudioDuration(data.duration || 0);
      setChunksCount(data.chunksCount || 1);
      setCurrentEngine(data.engine || 'gemini');
    } catch (err: any) {
      console.error('TTS Generation error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الصوت، يرجى المحاولة بعد لحظات.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950 font-['IBM_Plex_Sans_Arabic','Cairo',sans-serif]"
      dir="rtl"
    >
      {/* Dynamic, Tasteful Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Slow drifting cyan/teal ambient orb */}
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.92, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[15%] left-[30%] -translate-x-1/2 -translate-y-1/2 w-[480px] h-[320px] bg-cyan-500/12 blur-[140px] rounded-full"
        />

        {/* Slow drifting blue ambient orb */}
        <motion.div
          animate={{
            x: [0, -35, 30, 0],
            y: [0, 35, -25, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-[20%] right-[25%] w-[420px] h-[300px] bg-blue-600/10 blur-[130px] rounded-full"
        />

        {/* Subtle warm emerald accent orb */}
        <motion.div
          animate={{
            x: [0, 25, -20, 0],
            y: [0, -20, 25, 0],
            scale: [0.9, 1.1, 0.95, 0.9],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[50%] right-[10%] w-[320px] h-[220px] bg-teal-500/8 blur-[120px] rounded-full"
        />

        {/* Subtle background acoustic wave rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.035] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.05, 1] }}
            transition={{
              rotate: { duration: 80, repeat: Infinity, ease: 'linear' },
              scale: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="w-full h-full border border-dashed border-cyan-400 rounded-full flex items-center justify-center"
          >
            <div className="w-[75%] h-[75%] border border-cyan-300 rounded-full flex items-center justify-center">
              <div className="w-[60%] h-[60%] border border-dotted border-cyan-200 rounded-full" />
            </div>
          </motion.div>
        </div>

        {/* Floating subtle ambient particles */}
        {[
          { top: '22%', left: '18%', dur: 6, delay: 0 },
          { top: '45%', right: '15%', dur: 7.5, delay: 1 },
          { top: '70%', left: '22%', dur: 8, delay: 2 },
          { top: '30%', right: '28%', dur: 6.5, delay: 1.5 },
        ].map((p, idx) => (
          <motion.div
            key={idx}
            animate={{
              y: [0, -18, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: p.dur,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ top: p.top, left: p.left, right: p.right }}
            className="absolute w-1.5 h-1.5 bg-cyan-400/40 rounded-full blur-[0.5px]"
          />
        ))}
      </div>

      {/* Top Header Navigation Bar with Settings Gear Button */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-slate-950/60 backdrop-blur-md border-b border-slate-800/40" dir="rtl">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">القارئ الصوتي</span>
        </div>

        <button
          id="open-settings-button"
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/70 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all shadow-sm group cursor-pointer text-xs font-medium"
          title="إعدادات المفتاح (API Key)"
        >
          <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform duration-300" />
          <span>إعدادات المفتاح</span>
          {customApiKey ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
          ) : null}
        </button>
      </header>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-xl mx-auto flex flex-col gap-5 z-10 my-auto pt-20 pb-8 py-6"
      >
        {/* Sleek Typography Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
          >
            تحويل النص العربي إلى صوت
          </motion.h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md font-normal leading-relaxed">
            اكتب أو الصق أي نص باللغة العربية وسيتم تحويله فوراً إلى كلام صوتي طبيعي
          </p>
        </div>

        {/* Content Area */}
        <main className="w-full flex flex-col gap-3.5">
          {/* Text input area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-medium text-slate-300">النص المطلوب:</span>

              <div className="flex items-center gap-3">
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="مسح النص"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>مسح</span>
                  </button>
                )}
                {text.length > 0 && (
                  <div className="flex items-center gap-1.5 font-mono text-slate-400 text-[11px] tabular-nums">
                    <span>{text.length.toLocaleString('ar-EG')} حرف</span>
                    {text.length > 1200 && (
                      <span className="text-cyan-400/90 font-sans">
                        (~{Math.ceil(text.length / 1200)} أجزاء سريعة متوازية)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Glowing Interactive Textarea Container */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-teal-500/10 to-blue-500/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <textarea
                id="text-input-area"
                rows={5}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="اكتب أو الصق النص هنا (يقبل النصوص الطويلة والمقالات والكتب بكل سهولة وبسرعة فائقة)..."
                className="relative w-full rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-cyan-500/70 p-4 text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200 resize-none min-h-[140px] leading-relaxed shadow-lg shadow-black/30"
                dir="auto"
              />
            </div>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-rose-200 p-1 rounded cursor-pointer"
                  title="إغلاق التنبيه"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button - No emojis */}
          <div className="relative group">
            <motion.button
              id="generate-tts-button"
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={isGenerating || !text.trim() || countdown > 0}
              onClick={handleGenerateAudio}
              className="relative w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:via-teal-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-950/50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer overflow-hidden"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold">
                    {text.length > 1200
                      ? 'جاري تقسيم ومعالجة الأجزاء بالتوازي ودمج الصوت باحترافية...'
                      : 'جاري تحويل النص وسماع الصوت بسرعة فائقة...'}
                  </span>
                  {/* Animated equalizer wave bars */}
                  <div className="flex items-center gap-1 h-4 mr-1 shrink-0">
                    {[0.6, 1, 0.4, 0.9, 0.7].map((scale, i) => (
                      <motion.span
                        key={i}
                        animate={{ scaleY: [0.3, scale, 0.2] }}
                        transition={{
                          duration: 0.45 + i * 0.1,
                          repeat: Infinity,
                          repeatType: 'reverse',
                        }}
                        className="w-1 h-full bg-cyan-200 rounded-full origin-bottom"
                      />
                    ))}
                  </div>
                </div>
              ) : countdown > 0 ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-300" />
                  <span>انتظر {countdown} ثوانٍ لإعادة المحاولة...</span>
                </>
              ) : (
                <span>تحويل النص إلى صوت الآن</span>
              )}
            </motion.button>
          </div>

          {/* Unified Compact Audio Player & Download */}
          <AudioPlayer
            audioUrl={currentAudioUrl}
            duration={audioDuration}
            engine={currentEngine}
            blob={currentBlob}
            chunksCount={chunksCount}
          />
        </main>
      </motion.div>

      {/* Settings / API Key Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={customApiKey}
        onSaveKey={handleSaveApiKey}
      />
    </div>
  );
}
