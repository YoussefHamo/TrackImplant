import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2 } from 'lucide-react';
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
      allSchedules.forEach(s => {
        if (!grouped[s.doctor_id]) grouped[s.doctor_id] = [];
        grouped[s.doctor_id].push(s);
      });
      setSchedules(grouped);
    }
  }, [allSchedules]);

  const currentSchedules = schedules[selectedDoctor] || [];

  async function addSchedule() {
    if (editingDay === null || !selectedDoctor) return;
    const exists = currentSchedules.find(s => s.day_of_week === editingDay);
    if (exists) {
      await doctorScheduleService.upsert({ ...exists, start_time: editStart + ':00', end_time: editEnd + ':00' });
    } else {
      await doctorScheduleService.upsert({ doctor_id: selectedDoctor, day_of_week: editingDay, start_time: editStart + ':00', end_time: editEnd + ':00', is_active: true, branch_id: branchId || null } as any);
    }
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

  const inputClass = 'w-full h-9 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white';

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 'var(--z-dialog-overlay)', background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-2xl rounded-[24px] max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
            <h2 className="text-lg font-bold text-white">Doctor Schedules</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor</label>
              <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className={inputClass}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>Select doctor...</option>
                {(doctors || []).map((d: any) => (
                  <option key={d.auth_user_id} value={d.auth_user_id} style={{ background: '#0D1B2A', color: 'white' }}>{d.full_name || d.username}</option>
                ))}
              </select>
            </div>

            {selectedDoctor && (
              <div className="space-y-2">
                {DAY_NAMES.map((dayName, dayIdx) => {
                  const sch = currentSchedules.find(s => s.day_of_week === dayIdx);
                  const isEditing = editingDay === dayIdx;
                  return (
                    <div key={dayIdx} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="w-24 text-sm text-white/80 font-medium">{dayName}</div>
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <TimePicker value={editStart} onChange={setEditStart} />
                          <span className="text-white/40 text-sm">→</span>
                          <TimePicker value={editEnd} onChange={setEditEnd} />
                          <button onClick={addSchedule} className="px-3 h-9 rounded-xl text-xs font-bold" style={{ background: '#4FD1FF', color: '#050B14' }}>Save</button>
                          <button onClick={() => setEditingDay(null)} className="px-3 h-9 rounded-xl text-xs" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          {sch ? (
                            <span className="text-sm text-white/70">
                              {sch.start_time.slice(0, 5)} → {sch.end_time.slice(0, 5)}
                            </span>
                          ) : (
                            <span className="text-sm text-white/30 italic">Not set</span>
                          )}
                          {!readOnly && (
                            <button onClick={() => { setEditingDay(dayIdx); setEditStart(sch?.start_time.slice(0, 5) || '09:00'); setEditEnd(sch?.end_time.slice(0, 5) || '17:00'); }}
                              className="ml-auto px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                              {sch ? 'Edit' : 'Add'}
                            </button>
                          )}
                          {sch && !readOnly && (
                            <button onClick={() => deleteSchedule(sch.id)} className="p-1.5 rounded-lg" style={{ color: 'rgba(239,68,68,0.6)' }}>
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
