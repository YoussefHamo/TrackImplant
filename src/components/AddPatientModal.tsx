import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { patientService } from '../services/patientService';
import type { Patient } from '../types';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyForm = {
  full_name: '',
  phone: '',
  medical_history: '',
};

export default function AddPatientModal({ isOpen, onClose }: AddPatientModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setErrors({});
  };

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Omit<Patient, 'id' | 'created_at'> = {
        full_name: form.full_name,
        phone: form.phone,
        medical_history: form.medical_history || undefined,
      };
      return patientService.create(payload);
    },
    onSuccess: () => {
      toast.success('Patient added successfully');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add patient');
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    else if (!/^[\d\s\-+()]{7,20}$/.test(form.phone)) errs.phone = 'Invalid phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) mutation.mutate();
  };

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const rest = { ...prev }; delete rest[field]; return rest; });
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full h-10 px-3 rounded-xl text-sm outline-none transition-all duration-200 placeholder-gray-500 ${
      errors[field] ? 'border-red-500/50' : ''
    }` + ' bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white';

  const labelClass = 'text-[11px] font-semibold uppercase tracking-wider mb-1.5 block';
  const labelColor = { color: 'rgba(255,255,255,0.3)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div ref={dialogRef} className="w-full max-w-lg rounded-[24px] max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(13,24,40,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(79,209,255,0.03)',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
          <div>
            <h2 className="text-lg font-bold text-white">Add New Patient</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Enter patient information below</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label style={labelColor} className={labelClass}>Full Name *</label>
              <input value={form.full_name} onChange={e => update('full_name', e.target.value)}
                placeholder="الاسم الكامل / Full Name" className={inputClass('full_name')} dir="auto" />
              {errors.full_name && <p className="text-[11px] mt-1 text-red-400">{errors.full_name}</p>}
            </div>
            <div>
              <label style={labelColor} className={labelClass}>Mobile Number *</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                placeholder="رقم الجوال / Phone" className={inputClass('phone')} dir="ltr" />
              {errors.phone && <p className="text-[11px] mt-1 text-red-400">{errors.phone}</p>}
            </div>
            <div>
              <label style={labelColor} className={labelClass}>Medical History</label>
              <textarea value={form.medical_history} onChange={e => update('medical_history', e.target.value)}
                placeholder="التاريخ الطبي / Medical history" className={inputClass('medical_history') + ' h-24 pt-2 resize-none'} dir="auto" rows={3} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
            <button type="button" onClick={handleClose}
              className="h-10 px-5 rounded-xl text-sm font-medium transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="h-10 px-6 rounded-xl text-sm font-bold transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
                color: '#050B14',
                boxShadow: '0 4px 20px rgba(69,214,255,0.25)',
              }}
              onMouseEnter={e => { if (!mutation.isPending) e.currentTarget.style.boxShadow = '0 6px 30px rgba(69,214,255,0.4)'; }}
              onMouseLeave={e => { if (!mutation.isPending) e.currentTarget.style.boxShadow = '0 4px 20px rgba(69,214,255,0.25)'; }}>
              {mutation.isPending ? 'Saving...' : 'Save Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
