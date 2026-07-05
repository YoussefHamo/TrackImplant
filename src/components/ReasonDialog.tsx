import { useState } from 'react';
import type { ReasonCategory, ChangeReason } from '../types';
import { REASON_CATEGORIES } from '../utils/reasonCategories';
import Portal from './ui/Portal';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  requireCategory?: boolean;
  onConfirm: (reason: ChangeReason) => void;
  onCancel: () => void;
}

export default function ReasonDialog({
  open,
  title,
  description,
  requireCategory = true,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [category, setCategory] = useState<ReasonCategory | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (requireCategory && !category) {
      setError('Please select a reason category');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason description');
      return;
    }
    setError('');
    onConfirm({
      category: category as ReasonCategory,
      reason: reason.trim(),
    });
    setCategory('');
    setReason('');
  };

  const handleCancel = () => {
    setError('');
    setCategory('');
    setReason('');
    onCancel();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 'var(--z-dialog-overlay)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={handleCancel}
      >
        <div
          className="w-full max-w-md rounded-[22px] p-6 mx-4"
          style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          {description && (
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>{description}</p>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Category {requireCategory && <span className="text-red-400">*</span>}
              </label>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value as ReasonCategory); setError(''); }}
                className="w-full h-10 px-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: category ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}
              >
                <option value="" style={{ background: '#0D1B2A' }}>Select category...</option>
                {REASON_CATEGORIES.map(group => (
                  <optgroup key={group.group} label={group.group} style={{ background: '#0D1B2A', color: 'rgba(255,255,255,0.5)' }}>
                    {group.items.map(cat => (
                      <option key={cat} value={cat} style={{ background: '#0D1B2A', color: 'rgba(255,255,255,0.9)' }}>{cat}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => { setReason(e.target.value); setError(''); }}
                placeholder="Describe why this change is needed..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={handleCancel}
              className="h-10 px-5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="h-10 px-5 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
