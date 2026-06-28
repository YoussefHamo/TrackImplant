import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import {
  Plus, Search, X, Shield, UserCog,
  ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppUser, UserRole } from '../../types';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';

function roleBadge(role: UserRole) {
  const colors: Record<UserRole, { bg: string; text: string }> = {
    Admin: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF' },
    Doctor: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF' },
    Receptionist: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
    Assistant: { bg: 'rgba(255,193,7,0.12)', text: '#FFC107' },
  };
  const c = colors[role];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {role}
    </span>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AppUser | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<AppUser | null>(null);

  const [createForm, setCreateForm] = useState({ full_name: '', username: '', email: '', password: '', role: 'Doctor' as UserRole });
  const [editForm, setEditForm] = useState({ full_name: '', role: 'Doctor' as UserRole, is_active: true });
  const [showPassword, setShowPassword] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; full_name: string; email: string; password: string; role: UserRole }) =>
      userService.create(data),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setCreateForm({ full_name: '', username: '', email: '', password: '', role: 'Doctor' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { full_name?: string; role?: UserRole; is_active?: boolean } }) =>
      userService.update(id, data),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEdit(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (email: string) => userService.resetPassword(email),
    onSuccess: () => {
      toast.success('Password reset email sent');
      setShowPasswordReset(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    let list = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    return list;
  }, [users, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="font-sans select-none space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all duration-300 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* System Section */}
      <div className="rounded-[20px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.1)' }}>
            <Shield className="w-4 h-4" style={{ color: '#7C5CFF' }} />
          </div>
          <h2 className="text-base font-semibold text-white">System Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Version</span>
            <p className="text-sm font-medium text-white mt-1">1.0.0</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Environment</span>
            <p className="text-sm font-medium text-white mt-1">Production</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Database</span>
            <p className="text-sm font-medium text-green-400 mt-1">Connected</p>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="p-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)' }}>
              <UserCog className="w-4 h-4" style={{ color: '#4FD1FF' }} />
            </div>
            <h2 className="text-base font-semibold text-white">User Management</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search users..."
                className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }} />
            </div>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as UserRole | ''); setPage(1); }}
              className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[140px]">
              <option value="" style={{ background: '#0D1B2A' }}>All Roles</option>
              <option value="Admin" style={{ background: '#0D1B2A' }}>Admin</option>
              <option value="Doctor" style={{ background: '#0D1B2A' }}>Doctor</option>
              <option value="Receptionist" style={{ background: '#0D1B2A' }}>Receptionist</option>
            </select>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">User</div>
          <div className="flex-[1.5]">Username</div>
          <div className="flex-[2]">Email</div>
          <div className="flex-[1]">Role</div>
          <div className="flex-[1]">Status</div>
          <div className="w-28 text-right">Actions</div>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {searchQuery || roleFilter ? 'No users match your filters' : 'No users yet.'}
            </div>
          ) : paged.map(u => (
            <div key={u.id} className="flex items-center px-6 py-3.5 transition-all hover:bg-[rgba(255,255,255,0.02)]">
              <div className="flex-[2] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
                  {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-white">{u.full_name}</span>
              </div>
              <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{u.username}</div>
              <div className="flex-[2] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{u.email || '—'}</div>
              <div className="flex-[1]">{roleBadge(u.role)}</div>
              <div className="flex-[1]">
                {u.is_active ? (
                  <span className="text-xs font-medium text-[#00E5A8]">Active</span>
                ) : (
                  <span className="text-xs font-medium text-[#ef4444]">Disabled</span>
                )}
              </div>
              <div className="w-28 flex items-center justify-end gap-1">
                <button onClick={() => { setShowEdit(u); setEditForm({ full_name: u.full_name, role: u.role, is_active: u.is_active }); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,209,255,0.1)'; e.currentTarget.style.color = '#4FD1FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title="Edit User">
                  <UserCog className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowPasswordReset(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,193,7,0.1)'; e.currentTarget.style.color = '#FFC107'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title="Reset Password">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length > perPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                const n = idx + 1;
                return <button key={n} onClick={() => setPage(n)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold"
                  style={{ background: page === n ? 'rgba(79,209,255,0.12)' : 'transparent', border: `1px solid ${page === n ? 'rgba(79,209,255,0.2)' : 'rgba(255,255,255,0.06)'}`, color: page === n ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>{n}</button>;
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== CREATE USER MODAL ===== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">Create User</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Full Name *</label>
                <input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Dr. John Smith" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Username *</label>
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="dr_smith" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Email *</label>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  type="text" placeholder="Used for password recovery" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Password *</label>
                <div className="relative">
                  <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Role *</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="Doctor" style={{ background: '#0D1B2A' }}>Doctor</option>
                  <option value="Receptionist" style={{ background: '#0D1B2A' }}>Receptionist</option>
                </select>
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Admin accounts are created manually in the database only.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowCreate(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => {
                if (!createForm.full_name.trim() || !createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
                  toast.error('All fields are required'); return;
                }
                if (createForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
                createMutation.mutate(createForm);
              }} disabled={createMutation.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT USER MODAL ===== */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEdit(null); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">Edit User</h2>
              <button onClick={() => setShowEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                  {showEdit.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{showEdit.full_name}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>@{showEdit.username} · {showEdit.email || '—'}</div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Full Name</label>
                <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="Admin" style={{ background: '#0D1B2A' }}>Admin</option>
                  <option value="Doctor" style={{ background: '#0D1B2A' }}>Doctor</option>
                  <option value="Receptionist" style={{ background: '#0D1B2A' }}>Receptionist</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Account Status</label>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === true}
                      onChange={() => setEditForm(f => ({ ...f, is_active: true }))} className="accent-[#00E5A8]" />
                    <span style={{ color: '#00E5A8' }}>Active</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === false}
                      onChange={() => setEditForm(f => ({ ...f, is_active: false }))} className="accent-[#ef4444]" />
                    <span style={{ color: '#ef4444' }}>Disabled</span>
                  </label>
                </div>
                {!editForm.is_active && (
                  <p className="text-[11px] mt-1" style={{ color: '#ef4444' }}>User will not be able to log in</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowEdit(null)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => {
                if (!editForm.full_name.trim()) { toast.error('Full name is required'); return; }
                updateMutation.mutate({ id: showEdit.id, data: editForm });
              }} disabled={updateMutation.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PASSWORD RESET CONFIRMATION ===== */}
      {showPasswordReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPasswordReset(null); }}>
          <div className="w-full max-w-sm rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,193,7,0.1)' }}>
                <svg className="w-6 h-6" style={{ color: '#FFC107' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Reset Password?</h3>
              <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Send password reset email to <strong className="text-white">{showPasswordReset.username}@trackimplant.local</strong>?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowPasswordReset(null)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => resetPasswordMutation.mutate(`${showPasswordReset.username}@trackimplant.local`)} disabled={resetPasswordMutation.isPending}
                className="h-10 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#FFC107', color: '#050B14' }}>
                {resetPasswordMutation.isPending ? 'Sending...' : 'Send Reset Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
