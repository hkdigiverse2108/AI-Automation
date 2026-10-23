'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Award, Check, Sparkles, DollarSign, Clock, ShieldCheck, HeartHandshake } from 'lucide-react';
import Portal from './Portal';

const PREDEFINED_WIN_REASONS = [
  {
    id: 'Competitive Pricing & Value',
    label: 'Competitive Pricing & Value',
    icon: '💰',
    desc: 'Best quotation, budget-friendly & high ROI package'
  },
  {
    id: 'Fast Response & Follow-up',
    label: 'Fast Response & Follow-up',
    icon: '⚡',
    desc: 'Quick turnaround, timely answers & great consultation'
  },
  {
    id: 'Trust, Demo & Portfolio',
    label: 'Trust, Demo & Portfolio',
    icon: '🤝',
    desc: 'Impressed by live bot demo, case studies & credibility'
  },
  {
    id: 'Custom Requirements Matched',
    label: 'Custom Requirements Matched',
    icon: '🎯',
    desc: 'Our solution solved their exact technical/business pain point'
  },
  {
    id: 'Client Referral / Word of Mouth',
    label: 'Client Referral / Recommendation',
    icon: '👥',
    desc: 'Existing client recommendation or strong brand reputation'
  },
  {
    id: 'Special Discount / Deal Offer',
    label: 'Special Discount / Promotional Deal',
    icon: '🎁',
    desc: 'Limited-time package or seasonal discount closed the deal'
  },
  {
    id: 'Custom Reason',
    label: 'Other / Write My Own Reason',
    icon: '✍️',
    desc: 'Specify a custom reason in the field below'
  }
];

export default function LeadWonReasonModal({ isOpen, leadName, onClose, onConfirm }) {
  const [selectedReason, setSelectedReason] = useState('Competitive Pricing & Value');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedReason === 'Custom Reason' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedReason]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitting(true);
    try {
      let finalReason = selectedReason;
      if (selectedReason === 'Custom Reason') {
        finalReason = customNote.trim() ? customNote.trim() : 'General Deal Win';
      }

      await onConfirm({
        winReason: finalReason,
        notes: customNote.trim()
      });
      onClose();
    } catch (err) {
      console.error('Error confirming won reason:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
        <div 
          className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
                  <span>Mark Lead as Won! 🏆</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    Deal Win Reason
                  </span>
                </h3>
                <p className="text-[11px] text-wa-text-secondary mt-0.5 truncate max-w-xs sm:max-w-md">
                  Lead: <strong className="text-wa-text-primary dark:text-white">{leadName || 'Inquiry'}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
            {/* Quick Reason Cards */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-wa-text-secondary mb-2">
                Why was this deal won? (Deal convert hone ka main reason):
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PREDEFINED_WIN_REASONS.map((opt) => {
                  const isSelected = selectedReason === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedReason(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-wa-text-primary dark:text-white shadow-xs ring-1 ring-emerald-500/50'
                          : 'border-wa-border dark:border-wa-dark-border bg-slate-50/50 dark:bg-wa-dark-header/40 text-wa-text-secondary hover:border-wa-border/80 hover:bg-white dark:hover:bg-wa-dark-panel'
                      }`}
                    >
                      <span className="text-base shrink-0 select-none">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-semibold text-xs leading-tight ${isSelected ? 'text-emerald-700 dark:text-emerald-300 font-bold' : ''}`}>
                            {opt.label}
                          </p>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                        </div>
                        <p className="text-[10px] text-wa-text-light mt-0.5 leading-snug line-clamp-1">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes / Write Your Own Reason */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-wa-text-secondary mb-1.5 flex items-center justify-between">
                <span>Deal Notes or Custom Win Factor:</span>
                <span className="text-[10px] font-normal text-wa-text-light lowercase">
                  {selectedReason === 'Custom Reason' ? '(Required for custom reason)' : '(Optional feedback)'}
                </span>
              </label>
              
              <div className="relative">
                <textarea
                  ref={inputRef}
                  rows={3}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Deal convert hone me kya sabse effective raha? Jaise: 'Live WhatsApp bot demo dekh kar client ne 50% advance turant transfer kiya...' ya koi deal feedback..."
                  className="w-full p-3 bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              <p className="text-[10px] text-wa-text-light mt-1">
                Ye win factors aapke <strong>Lead Analytics</strong> dashboard me success drivers analyze karne me help karte hain.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-wa-border/50 dark:border-wa-dark-border/50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Award className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : 'Confirm & Mark as Won'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
