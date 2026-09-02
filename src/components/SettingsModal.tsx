import React, { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle2, AlertCircle, Loader2, ExternalLink, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message?: string;
  }>({ type: 'idle' });

  useEffect(() => {
    if (isOpen) {
      setInputKey(apiKey);
      setVerifyStatus({ type: 'idle' });
    }
  }, [isOpen, apiKey]);

  const handleVerifyAndSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setVerifyStatus({
        type: 'error',
        message: 'يرجى إدخال مفتاح API صحيح أولاً.',
      });
      return;
    }

    setIsVerifying(true);
    setVerifyStatus({ type: 'idle' });

    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        setVerifyStatus({
          type: 'success',
          message: 'تم التحقق من المفتاح بنجاح! جاهز لتوليد الصوت بأعلى جودة.',
        });
        onSaveKey(trimmed);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setVerifyStatus({
          type: 'error',
          message: data.error || 'المفتاح غير صالح أو تم إيقافه من Google. يرجى التحقق منه.',
        });
      }
    } catch (err: any) {
      setVerifyStatus({
        type: 'error',
        message: err.message || 'تعذر الاتصال بالخادم للتحقق من المفتاح.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveKey = () => {
    setInputKey('');
    onSaveKey('');
    setVerifyStatus({
      type: 'success',
      message: 'تمت إزالة المفتاح المخصص والعودة للإعداد الافتراضي.',
    });
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-right text-slate-200 overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">إعدادات مفتاح Gemini API</h3>
                <p className="text-xs text-slate-400 font-normal">تخصيص المفتاح لتوليد الصوت بلا قيود</p>
              </div>
            </div>
            <button
              id="close-settings-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gemini-api-key-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>مفتاح API الخاص بك (Gemini API Key):</span>
              </label>
              <div className="relative">
                <input
                  id="gemini-api-key-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder:text-slate-600"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                يتم حفظ المفتاح محلياً في متصفحك ويُرسل إلى الخادم لمعالجة الصوت عبر نموذج Gemini مباشرة.
              </p>
            </div>

            {/* Status Alert */}
            {verifyStatus.type !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                  verifyStatus.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                }`}
              >
                {verifyStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{verifyStatus.message}</span>
              </motion.div>
            )}

            {/* Get API Key link */}
            <a
              id="get-gemini-key-link"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-cyan-300 transition-all group"
            >
              <span className="flex items-center gap-1.5">
                <span>الحصول على مفتاح مجاني جديد من Google AI Studio</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </a>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-2">
            {apiKey ? (
              <button
                id="remove-api-key-btn"
                type="button"
                onClick={handleRemoveKey}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إزالة المفتاح</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                id="cancel-settings-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                إغلاق
              </button>
              <button
                id="save-api-key-btn"
                type="button"
                disabled={isVerifying || !inputKey.trim()}
                onClick={handleVerifyAndSave}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <span>حفظ وتفعيل</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
