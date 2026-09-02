import React from 'react';
import { SAMPLE_TEXTS } from '../data/voices';
import { Sparkles } from 'lucide-react';

interface SamplePhrasesProps {
  onSelectSample: (text: string) => void;
  disabled?: boolean;
}

export const SamplePhrases: React.FC<SamplePhrasesProps> = ({
  onSelectSample,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 ml-1">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span>نماذج سريعة:</span>
      </span>
      {SAMPLE_TEXTS.map((sample, idx) => (
        <button
          key={idx}
          id={`sample-phrase-button-${idx}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelectSample(sample.text)}
          className="text-xs px-2.5 py-1 rounded-lg bg-black/30 hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all active:scale-95 disabled:opacity-50"
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
};
