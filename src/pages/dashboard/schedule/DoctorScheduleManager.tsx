import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Save } from 'lucide-react';
import { userService } from '../../../services/userService';
import { doctorScheduleService } from '../../../services/doctorScheduleService';
import Portal from '../../../components/ui/Portal';
import TimePicker from '../../../components/ui/TimePicker';
import type { DoctorSchedule } from '../../../types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DoctorScheduleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string | null;
  readOnly?: boolean;
}

export default function DoctorScheduleManager({ isOpen, onClose, branchId, readOnly }: DoctorScheduleManagerProps) {
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<Record<string, DoctorSchedule[]>>({});
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('17:00');

  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: () => userService.getAll().then(users => users.filter(u => u.role === 'Doctor')) });
  const { data: allSchedules } = useQuery({ queryKey: ['doctor-schedules-all', branchId], queryFn: () => doctorScheduleService.getAll(branchId), enabled: isOpen });

  useEffect(() => {
    if (allSchedules) {
      const grouped: Record<string, DoctorSchedule[]> = {};
      allSchedules.forEach(s => { if (!grouped[s.doctor_id]) grouped[s.doctor_id] = []; grouped[s.doctor_id].push(s); });
      setSchedules(grouped);
    }
  }, [allSchedules]);

  const currentSchedules = schedules[selectedDoctor] || [];

  async function addSchedule() {
    if (editingDay === null || !selectedDoctor) return;
    const exists = currentSchedules.find(s => s.day_of_week === editingDay);
    if (exists) { await doctorScheduleService.upsert({ ...exists, start_time: editStart + ':00', end_time: editEnd + ':00' }); }
    else { await doctorScheduleService.upsert({ doctor_id: selectedDoctor, day_of_week: editingDay, start_time: editStart + ':00', end_time: editEnd + ':00', is_active: true, branch_id: branchId || null } as any); }
    setEditingDay(null);
    await queryClient.invalidateQueries({ queryKey: ['doctor-schedules-all'] });
    const updated = await doctorScheduleService.getAll(branchId);
    const grouped: Record<string, DoctorSchedule[]> = {};
    updated.forEach(s => { if (!grouped[s.doctor_id]) grouped[s.doctor_id] = []; grouped[s.doctor_id].push(s); });
    setSchedules(grouped);
  }

  async function deleteSchedule(scheduleId: string) {
    await doctorScheduleService.delete(scheduleId);
    await queryClient.invalidateQueries({ queryKey: ['doctor-schedules-all'] });
    const updated = await doctorScheduleService.getAll(branchId);
    const grouped: Record<string, DoctorSchedule[]> = {};
    updated.forEach(s => { if (!grouped[s.doctor_id]) grouped[s.doctor_id] = []; grouped[s.doctor_id].push(s); });
    setSchedules(grouped);
  }

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 'var(--z-dialog-overlay)', background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-2xl rounded-[24px] max-h-[90vh] overflow-y-auto glass-strong">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderBottom: '1px solid var(--app-border)' }}>
            <h2 className="text-lg font-bold text-[var(--app-text)] font-sans">Doctor Schedules</h2>
            <button onClick={onClose} className="btn-ghost btn-xs w-8 h-8 rounded-xl p-0 flex items-center justify-center" aria-label="Close dialog">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Doctor Selector */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Doctor</label>
              <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="input-cyber" aria-label="Select doctor">
                <option value="">Select doctor...</option>
                {(doctors || []).map((d: any) => (<option key={d.auth_user_id} value={d.auth_user_id}>{d.full_name || d.username}</option>))}
              </select>
            </div>

            {/* Schedule Grid */}
            {selectedDoctor && (
              <div className="space-y-2">
                {DAY_NAMES.map((dayName, dayIdx) => {
                  const sch = currentSchedules.find(s => s.day_of_week === dayIdx);
                  const isEditing = editingDay === dayIdx;
                  return (
                    <div key={dayIdx} className="flex items-center gap-3 p-3 rounded-xl font-sans" style={{ background: 'var(--app-hover)' }}>
                      <div className="w-24 text-sm font-medium" style={{ color: 'var(--app-text-dim)' }}>{dayName}</div>
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <TimePicker value={editStart} onChange={setEditStart} />
                          <span style={{ color: 'var(--app-text-muted)' }}>→</span>
                          <TimePicker value={editEnd} onChange={setEditEnd} />
                          <button onClick={addSchedule} className="btn-primary btn-sm h-9 px-3 text-xs" aria-label="Save schedule">
                            <Save className="w-3 h-3" /> Save
                          </button>
                          <button onClick={() => setEditingDay(null)} className="btn-ghost btn-sm h-9 px-3 text-xs" aria-label="Cancel editing">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          {sch ? (
                            <span className="text-sm font-mono" style={{ color: 'var(--app-text-dim)' }}>
                              {sch.start_time.slice(0, 5)} → {sch.end_time.slice(0, 5)}
                            </span>
                          ) : (
                            <span className="text-sm italic" style={{ color: 'var(--app-text-muted)' }}>Not set</span>
                          )}
                          {!readOnly && (
                            <button onClick={() => { setEditingDay(dayIdx); setEditStart(sch?.start_time.slice(0, 5) || '09:00'); setEditEnd(sch?.end_time.slice(0, 5) || '17:00'); }}
                              className="ml-auto btn-ghost btn-sm h-8 px-3 text-xs" aria-label={sch ? 'Edit schedule' : 'Add schedule'}>
                              {sch ? 'Edit' : 'Add'}
                            </button>
                          )}
                          {sch && !readOnly && (
                            <button onClick={() => deleteSchedule(sch.id)} className="btn-ghost btn-sm w-8 h-8 p-0 flex items-center justify-center"
                              aria-label="Delete schedule" style={{ color: 'var(--color-error)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
