import React, { useState } from 'react';
import { VoiceOption } from '../types';
import { AVAILABLE_VOICES } from '../data/voices';
import { Check, ChevronDown, AudioLines } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  disabled?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoiceId,
  onSelectVoice,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentVoice =
    AVAILABLE_VOICES.find((v) => v.id === selectedVoiceId) || AVAILABLE_VOICES[0];

  return (
    <div className="flex flex-col gap-2">
      {/* Header Label */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <label className="font-medium text-slate-300 flex items-center gap-1.5">
          <span>اختيار صوت الذكاء الاصطناعي (Gemini Voice):</span>
        </label>
        <span className="text-[11px] font-mono text-cyan-400/80">
          {currentVoice.name} — {currentVoice.toneAr}
        </span>
      </div>

      {/* Quick Visual Voice Pills */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {AVAILABLE_VOICES.map((v) => {
          const isSelected = v.id === selectedVoiceId;
          return (
            <button
              key={v.id}
              id={`quick-voice-btn-${v.id}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectVoice(v.id)}
              className={`p-2 rounded-xl text-center flex flex-col items-center gap-1 transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/40'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              } disabled:opacity-50`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  isSelected
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSelected ? (
                  <AudioLines className="w-3.5 h-3.5" />
                ) : (
                  <span>{v.name.slice(0, 1)}</span>
                )}
              </div>
              <span className="text-xs font-semibold truncate w-full">{v.name}</span>
              <span className="text-[10px] text-slate-400 truncate w-full font-normal">
                {v.gender === 'female' ? 'أنثى' : 'ذكر'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
