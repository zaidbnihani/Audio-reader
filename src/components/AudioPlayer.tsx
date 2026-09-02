import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';

interface AudioPlayerProps {
  audioUrl: string | null;
  duration?: number;
  voiceName?: string;
  blob?: Blob | null;
  engine?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  duration = 0,
  voiceName,
  blob,
  engine,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Sync duration
  useEffect(() => {
    if (duration > 0) {
      setAudioDuration(duration);
    }
  }, [duration]);

  // When audioUrl changes, immediately load and attempt playback
  useEffect(() => {
    if (!audioUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    setCurrentTime(0);
    setIsDownloaded(false);

    if (audioRef.current) {
      audioRef.current.load();
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            // Autoplay policy on mobile devices may require a direct user tap on the play button
            console.log('Autoplay requires manual user tap on play button:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Audio tag playback error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setAudioDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || !audioDuration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audioDuration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const isMp3 = blob?.type?.includes('mp3') || blob?.type?.includes('mpeg');
    const ext = isMp3 ? 'mp3' : 'wav';
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `voice_${timestamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2000);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return null;
  }

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-lg shadow-black/30 flex flex-col gap-2.5"
      dir="rtl"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current?.duration) {
            setAudioDuration(audioRef.current.duration);
          }
        }}
        onCanPlay={() => {
          // If marked playing or ready, ensure it begins playing
          if (isPlaying && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Unified Compact Control Bar */}
      <div className="flex items-center gap-2.5 sm:gap-3 w-full">
        {/* Toggle Play / Pause button */}
        <button
          id="audio-play-button"
          type="button"
          onClick={togglePlayPause}
          className="h-9 px-3.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer active:scale-95 border bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/50 shadow-md shadow-cyan-950/40"
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل الصوت'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>إيقاف مؤقت</span>
              {/* Subtle animated sound wave equalizer */}
              <div className="flex items-center gap-0.5 h-3.5 mr-0.5">
                {[0.8, 1, 0.4, 0.9].map((val, i) => (
                  <motion.span
                    key={i}
                    animate={{ scaleY: [0.3, val, 0.2] }}
                    transition={{
                      duration: 0.5 + i * 0.12,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                    }}
                    className="w-0.5 h-full bg-cyan-100 rounded-full origin-bottom"
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>تشغيل</span>
            </>
          )}
        </button>

        {/* Compact Progress Bar with Time */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
            {formatTime(currentTime)}
          </span>

          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="relative flex-1 h-2 bg-slate-800 hover:h-2.5 rounded-full cursor-pointer transition-all overflow-hidden border border-slate-700/60 min-w-[50px]"
            title="انقر للتنقل في المقطع"
          >
            <div
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 to-teal-400 transition-all rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
            {formatTime(audioDuration)}
          </span>
        </div>

        {/* Compact Download Button */}
        <button
          id="audio-download-button"
          type="button"
          onClick={handleDownload}
          className={`h-9 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0 transition-all duration-150 active:scale-95 cursor-pointer border ${
            isDownloaded
              ? 'bg-teal-600 text-white border-teal-500/50 shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700/80 hover:border-slate-600 shadow-sm'
          }`}
          title="تحميل الملف الصوتي"
        >
          {isDownloaded ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">تم التحميل</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">تحميل</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
