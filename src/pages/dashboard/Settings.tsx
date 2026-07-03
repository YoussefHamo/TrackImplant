import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { userService } from '../../services/userService';
import { branchService } from '../../services/branchService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Search, X, Shield, UserCog, Globe, Sun, Moon, User,
  ChevronLeft, ChevronRight, Eye, EyeOff, Download, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppUser, UserRole } from '../../types';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';

function roleBadge(role: UserRole) {
  const colors: Record<string, { bg: string; text: string }> = {
    Manager: { bg: 'rgba(255,69,0,0.12)', text: '#FF4500' },
    Admin: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF' },
    Doctor: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF' },
    Receptionist: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
    Assistant: { bg: 'rgba(255,193,7,0.12)', text: '#FFC107' },
  };
  const c = colors[role] || colors.Admin;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {role}
    </span>
  );
}

export default function Settings() {
  const { t, lang, setLang } = useLanguage();
  const { setTheme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AppUser | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<AppUser | null>(null);

  const [createForm, setCreateForm] = useState({ full_name: '', username: '', email: '', password: '', role: 'Doctor' as UserRole, branch_id: '' });
  const [editForm, setEditForm] = useState({ full_name: '', role: 'Doctor' as UserRole, is_active: true, branch_id: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; full_name: string; email: string; password: string; role: UserRole; branch_id?: string }) =>
      userService.create(data),
    onSuccess: () => {
      toast.success(t('settings.toast_user_created'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setCreateForm({ full_name: '', username: '', email: '', password: '', role: 'Doctor', branch_id: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { full_name?: string; role?: UserRole; is_active?: boolean; branch_id?: string | null } }) =>
      userService.update(id, data),
    onSuccess: () => {
      toast.success(t('common.save'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEdit(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* Load profile data when user is available */
  if (user && !profileLoaded) {
    setProfileName(user.full_name);
    setProfileEmail(user.email || '');
    setProfileLoaded(true);
  }

  const updateProfileMut = useMutation({
    mutationFn: async (data: { full_name?: string; email?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return userService.updateByAuthId(user.id, data);
    },
    onSuccess: () => {
      toast.success(t('settings.toast_profile_saved'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePasswordMut = useMutation({
    mutationFn: async () => {
      if (!currentPassword || !newPassword) throw new Error(t('settings.toast_fields_required'));
      if (newPassword.length < 6) throw new Error(t('settings.toast_password_length'));
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('settings.toast_password_updated'));
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (email: string) => userService.resetPassword(email),
    onSuccess: () => {
      toast.success(t('settings.toast_reset_sent'));
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
          <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {t('settings.subtitle', { count: users.length })}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all duration-300 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
          <Plus className="w-4 h-4" /> {t('settings.create_user')}
        </button>
      </div>

      {/* Language Section */}
      <div className="rounded-[20px] p-6" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,229,168,0.1)' }}>
            <Globe className="w-4 h-4" style={{ color: '#00E5A8' }} />
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>{t('settings.language')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang('en')}
            className={`h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${lang === 'en' ? '' : 'opacity-50'}`}
            style={{
              background: lang === 'en' ? 'linear-gradient(135deg, #45D6FF, #53C7F0)' : 'var(--app-input-bg)',
              color: lang === 'en' ? '#050B14' : 'rgba(255,255,255,0.6)',
              border: lang === 'en' ? 'none' : '1px solid var(--app-input-border)',
            }}>
            {t('settings.language_english')}
          </button>
          <button onClick={() => setLang('ar')}
            className={`h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${lang === 'ar' ? '' : 'opacity-50'}`}
            style={{
              background: lang === 'ar' ? 'linear-gradient(135deg, #45D6FF, #53C7F0)' : 'var(--app-input-bg)',
              color: lang === 'ar' ? '#050B14' : 'rgba(255,255,255,0.6)',
              border: lang === 'ar' ? 'none' : '1px solid var(--app-input-border)',
            }}>
            {t('settings.language_arabic')}
          </button>
        </div>
      </div>

      {/* Theme Section */}
      <div className="rounded-[20px] p-6" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(255,193,7,0.1)' : 'rgba(79,209,255,0.1)' }}>
            {isDark ? <Sun className="w-4 h-4" style={{ color: '#FFC107' }} /> : <Moon className="w-4 h-4" style={{ color: '#4FD1FF' }} />}
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>{t('settings.theme')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme('dark')}
            className={`h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${isDark ? '' : 'opacity-50'}`}
            style={{
              background: isDark ? 'linear-gradient(135deg, #45D6FF, #53C7F0)' : 'var(--app-input-bg)',
              color: isDark ? '#050B14' : 'rgba(255,255,255,0.6)',
              border: isDark ? 'none' : '1px solid var(--app-input-border)',
            }}>
            <Moon className="w-4 h-4 inline mr-1.5" />{t('settings.theme_dark')}
          </button>
          <button onClick={() => setTheme('light')}
            className={`h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${!isDark ? '' : 'opacity-50'}`}
            style={{
              background: !isDark ? 'linear-gradient(135deg, #45D6FF, #53C7F0)' : 'var(--app-input-bg)',
              color: !isDark ? '#050B14' : 'rgba(255,255,255,0.6)',
              border: !isDark ? 'none' : '1px solid var(--app-input-border)',
            }}>
            <Sun className="w-4 h-4 inline mr-1.5" />{t('settings.theme_light')}
          </button>
        </div>
      </div>

      {/* Profile Section */}
      {user && (
        <div className="rounded-[20px] p-6" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)' }}>
              <User className="w-4 h-4" style={{ color: '#4FD1FF' }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>{t('settings.profile')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.profile_full_name')}</label>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.profile_email')}</label>
              <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={() => updateProfileMut.mutate({ full_name: profileName, email: profileEmail })}
              disabled={updateProfileMut.isPending}
              className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
              {updateProfileMut.isPending ? t('settings.profile_saving') : t('settings.profile_save')}
            </button>
            <button onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.15)', color: '#FFC107' }}>
              {t('settings.profile_change_password')}
            </button>
          </div>
          {showPasswordForm && (
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)] space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.profile_current_password')}</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.profile_new_password')}</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button onClick={() => updatePasswordMut.mutate()}
                disabled={updatePasswordMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#FFC107', color: '#050B14' }}>
                {updatePasswordMut.isPending ? t('settings.profile_updating') : t('settings.profile_update_password')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* System Section */}
      <div className="rounded-[20px] p-6" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.1)' }}>
            <Shield className="w-4 h-4" style={{ color: '#7C5CFF' }} />
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>{t('settings.system_info')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.version')}</span>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--app-text)' }}>1.0.0</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.environment')}</span>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--app-text)' }}>{t('app.env')}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.database')}</span>
            <p className="text-sm font-medium text-green-400 mt-1">{t('app.db')}</p>
          </div>
        </div>
      </div>

      {/* Backup Section */}
      <div className="rounded-[20px] p-6" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,229,168,0.1)' }}>
            <Download className="w-4 h-4" style={{ color: '#00E5A8' }} />
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>Backup & Restore</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Export your data as CSV, Excel, or JSON. Import previously exported data to restore.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={async () => {
            try {
              const { supabase } = await import('../../integrations/supabase/client');
              const tables = ['patients', 'procedures', 'appointments', 'financial_records', 'follow_ups', 'inventory_items', 'implant_inventory', 'abutment_inventory', 'cross_branch_requests', 'audit_logs'];
              const data: Record<string, unknown[]> = {};
              for (const table of tables) {
                const { data: rows } = await supabase.from(table).select('*').limit(5000);
                if (rows) data[table] = rows;
              }
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `trackimplant_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
              URL.revokeObjectURL(url);
              toast.success('Backup exported as JSON');
            } catch { toast.error('Export failed'); }
          }} className="h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(0,229,168,0.1)', border: '1px solid rgba(0,229,168,0.15)', color: '#00E5A8' }}>
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button onClick={async () => {
            try {
              const XLSX = await import('xlsx');
              const { supabase } = await import('../../integrations/supabase/client');
              const tables = ['patients', 'procedures', 'appointments', 'financial_records', 'follow_ups', 'inventory_items'];
              const wb = XLSX.utils.book_new();
              for (const table of tables) {
                const { data: rows } = await supabase.from(table).select('*').limit(5000);
                if (rows) {
                  const ws = XLSX.utils.json_to_sheet(rows);
                  XLSX.utils.book_append_sheet(wb, ws, table);
                }
              }
              XLSX.writeFile(wb, `trackimplant_export_${new Date().toISOString().split('T')[0]}.xlsx`);
              toast.success('Excel export complete');
            } catch { toast.error('Export failed'); }
          }} className="h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <label className="h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.15)', color: '#FFC107' }}>
            <Upload className="w-3.5 h-3.5" /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                const { supabase } = await import('../../integrations/supabase/client');
                let imported = 0;
                for (const [table, rows] of Object.entries(data)) {
                  if (Array.isArray(rows)) {
                    for (const row of rows) {
                      const { error } = await supabase.from(table).upsert(row).select();
                      if (!error) imported++;
                    }
                  }
                }
                toast.success(`Imported ${imported} records`);
              } catch { toast.error('Import failed — check file format'); }
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      {/* User Management Section */}
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="p-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)' }}>
              <UserCog className="w-4 h-4" style={{ color: '#4FD1FF' }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>{t('settings.user_management')}</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder={t('settings.search_placeholder')}
                className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }} />
            </div>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as UserRole | ''); setPage(1); }}
              className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[140px]">
              <option value="" style={{ background: '#0D1B2A' }}>{t('settings.filter_all_roles')}</option>
              <option value="Manager" style={{ background: '#0D1B2A' }}>Manager</option>
              <option value="Admin" style={{ background: '#0D1B2A' }}>{t('common.role_admin')}</option>
              <option value="Doctor" style={{ background: '#0D1B2A' }}>{t('common.role_doctor')}</option>
              <option value="Receptionist" style={{ background: '#0D1B2A' }}>{t('common.role_receptionist')}</option>
              <option value="Assistant" style={{ background: '#0D1B2A' }}>Assistant</option>
            </select>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">{t('settings.table_user')}</div>
          <div className="flex-[1.5]">{t('settings.table_username')}</div>
          <div className="flex-[2]">{t('settings.table_email')}</div>
          <div className="flex-[1]">{t('settings.table_role')}</div>
          <div className="flex-[1]">{t('settings.branch')}</div>
          <div className="flex-[1]">{t('settings.table_status')}</div>
          <div className="w-28 text-right">{t('settings.table_actions')}</div>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {searchQuery || roleFilter ? t('settings.empty_filters') : t('settings.empty_all')}
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
              <div className="flex-[1] text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {u.branch_id ? branches.find(b => b.id === u.branch_id)?.name || '—' : t('settings.no_branch')}
              </div>
              <div className="flex-[1]">
                {u.is_active ? (
                  <span className="text-xs font-medium text-[#00E5A8]">{t('common.status_active')}</span>
                ) : (
                  <span className="text-xs font-medium text-[#ef4444]">{t('common.status_disabled')}</span>
                )}
              </div>
              <div className="w-28 flex items-center justify-end gap-1">
                <button onClick={() => { setShowEdit(u); setEditForm({ full_name: u.full_name, role: u.role, is_active: u.is_active, branch_id: u.branch_id || '' }); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,209,255,0.1)'; e.currentTarget.style.color = '#4FD1FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title={t('common.edit')}>
                  <UserCog className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowPasswordReset(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,193,7,0.1)'; e.currentTarget.style.color = '#FFC107'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title={t('common.edit')}>
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
              {t('common.showing_entries', { start: (page - 1) * perPage + 1, end: Math.min(page * perPage, filtered.length), total: filtered.length })}
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
              <h2 className="text-lg font-bold text-white">{t('settings.modal_create_title')}</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_create_full_name')}</label>
                <input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder={t('settings.placeholder_full_name')} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_create_username')}</label>
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  placeholder={t('settings.placeholder_username')} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_create_email')}</label>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  type="text" placeholder={t('settings.placeholder_email')} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_create_password')}</label>
                <div className="relative">
                  <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? 'text' : 'password'} placeholder={t('settings.placeholder_password')} className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_create_role')}</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="Manager" style={{ background: '#0D1B2A' }}>Manager</option>
                  <option value="Admin" style={{ background: '#0D1B2A' }}>Admin</option>
                  <option value="Doctor" style={{ background: '#0D1B2A' }}>{t('common.role_doctor')}</option>
                  <option value="Receptionist" style={{ background: '#0D1B2A' }}>{t('common.role_receptionist')}</option>
                  <option value="Assistant" style={{ background: '#0D1B2A' }}>Assistant</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.branch')}</label>
                <select value={createForm.branch_id} onChange={e => setCreateForm(f => ({ ...f, branch_id: e.target.value }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="" style={{ background: '#0D1B2A' }}>{t('settings.no_branch')}</option>
                  {branches.map(b => (<option key={b.id} value={b.id} style={{ background: '#0D1B2A' }}>{b.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowCreate(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('settings.modal_create_cancel')}</button>
              <button onClick={() => {
                if (!createForm.full_name.trim() || !createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
                  toast.error(t('settings.toast_fields_required')); return;
                }
                if (createForm.password.length < 6) { toast.error(t('settings.toast_password_length')); return; }
                createMutation.mutate(createForm);
              }} disabled={createMutation.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                {createMutation.isPending ? t('settings.modal_create_creating') : t('settings.modal_create_confirm')}
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
              <h2 className="text-lg font-bold text-white">{t('settings.modal_edit_title')}</h2>
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
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('settings.modal_edit_user_info', { username: showEdit.username, email: showEdit.email || '—' })}</div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_edit_full_name')}</label>
                <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_edit_role')}</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="Manager" style={{ background: '#0D1B2A' }}>Manager</option>
                  <option value="Admin" style={{ background: '#0D1B2A' }}>{t('common.role_admin')}</option>
                  <option value="Doctor" style={{ background: '#0D1B2A' }}>{t('common.role_doctor')}</option>
                  <option value="Receptionist" style={{ background: '#0D1B2A' }}>{t('common.role_receptionist')}</option>
                  <option value="Assistant" style={{ background: '#0D1B2A' }}>Assistant</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.branch')}</label>
                <select value={editForm.branch_id} onChange={e => setEditForm(f => ({ ...f, branch_id: e.target.value }))}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="" style={{ background: '#0D1B2A' }}>{t('settings.no_branch')}</option>
                  {branches.map(b => (<option key={b.id} value={b.id} style={{ background: '#0D1B2A' }}>{b.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('settings.modal_edit_status')}</label>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === true}
                      onChange={() => setEditForm(f => ({ ...f, is_active: true }))} className="accent-[#00E5A8]" />
                    <span style={{ color: '#00E5A8' }}>{t('settings.modal_edit_active')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === false}
                      onChange={() => setEditForm(f => ({ ...f, is_active: false }))} className="accent-[#ef4444]" />
                    <span style={{ color: '#ef4444' }}>{t('settings.modal_edit_disabled')}</span>
                  </label>
                </div>
                {!editForm.is_active && (
                  <p className="text-[11px] mt-1" style={{ color: '#ef4444' }}>{t('settings.modal_edit_warning')}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowEdit(null)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('settings.modal_edit_cancel')}</button>
              <button onClick={() => {
                if (!editForm.full_name.trim()) { toast.error(t('settings.toast_name_required')); return; }
                updateMutation.mutate({ id: showEdit.id, data: editForm });
              }} disabled={updateMutation.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                {updateMutation.isPending ? t('settings.modal_edit_saving') : t('settings.modal_edit_confirm')}
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
              <h3 className="text-lg font-bold text-white text-center mb-2">{t('settings.modal_reset_title')}</h3>
              <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {t('settings.modal_reset_desc', { email: `${showPasswordReset.username}@trackimplant.local` })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowPasswordReset(null)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('settings.modal_reset_cancel')}</button>
              <button onClick={() => resetPasswordMutation.mutate(`${showPasswordReset.username}@trackimplant.local`)} disabled={resetPasswordMutation.isPending}
                className="h-10 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#FFC107', color: '#050B14' }}>
                {resetPasswordMutation.isPending ? t('settings.modal_reset_sending') : t('settings.modal_reset_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
