import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { userService } from '../../services/userService';
import { branchService } from '../../services/branchService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Search, X, Shield, UserCog, Globe, Sun, Moon, User,
  ChevronLeft, ChevronRight, Eye, EyeOff, Download, Upload,
  Bell, BellOff, Settings2, Database, FileJson, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppUser, UserRole } from '../../types';
import FixedOverlay from '../../components/ui/FixedOverlay';
import { notificationPreferenceService } from '../../services/notificationPreferenceService';
import type { NotificationCategory } from '../../services/notificationService';

function roleBadge(role: UserRole) {
  const colors: Record<string, { bg: string; text: string }> = {
    Manager: { bg: 'rgba(255,69,0,0.12)', text: '#FF4500' },
    Admin: { bg: 'var(--color-secondary-container)', text: 'var(--color-secondary)' },
    Doctor: { bg: 'var(--color-primary-container)', text: 'var(--color-primary)' },
    Receptionist: { bg: 'var(--color-success-container)', text: 'var(--color-success)' },
    Assistant: { bg: 'var(--color-warning-container)', text: 'var(--color-warning)' },
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

  const [activeTab, setActiveTab] = useState('general');
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
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});
  const [prefsLoading, setPrefsLoading] = useState(true);
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

  if (user && !profileLoaded) {
    setProfileName(user.full_name);
    setProfileEmail(user.email || '');
    setProfileLoaded(true);
  }

  useEffect(() => {
    if (!user?.id) return;
    notificationPreferenceService.bulkInit(user.id).then(() => {
      notificationPreferenceService.getAll(user.id).then(prefs => {
        const map: Record<string, boolean> = {};
        prefs.forEach(p => { map[p.category] = p.in_app; });
        setNotificationPrefs(map);
        setPrefsLoading(false);
      });
    }).catch(() => setPrefsLoading(false));
  }, [user?.id]);

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

  const tabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'system', label: 'System', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-on-surface)]">{t('settings.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
            {t('settings.subtitle', { count: users.length })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap border-b pb-1" style={{ borderColor: 'var(--app-border)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1.5"
            style={{
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--app-text-dim)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── General Tab ─── */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Language Section */}
          <div className="card-cyber">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-success-container)' }}>
                <Globe className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              </div>
              <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{t('settings.language')}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setLang('en')}
                className={`btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}>
                {t('settings.language_english')}
              </button>
              <button onClick={() => setLang('ar')}
                className={`btn-sm ${lang === 'ar' ? 'btn-primary' : 'btn-ghost'}`}>
                {t('settings.language_arabic')}
              </button>
            </div>
          </div>

          {/* Theme Section */}
          <div className="card-cyber">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'var(--color-warning-container)' : 'var(--color-primary-container)' }}>
                {isDark ? <Sun className="w-4 h-4" style={{ color: 'var(--color-warning)' }} /> : <Moon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />}
              </div>
              <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{t('settings.theme')}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setTheme('dark')}
                className={`btn-sm ${isDark ? 'btn-primary' : 'btn-ghost'}`}>
                <Moon className="w-4 h-4" />{t('settings.theme_dark')}
              </button>
              <button onClick={() => setTheme('light')}
                className={`btn-sm ${!isDark ? 'btn-primary' : 'btn-ghost'}`}>
                <Sun className="w-4 h-4" />{t('settings.theme_light')}
              </button>
            </div>
          </div>

          {/* Profile Section */}
          {user && (
            <div className="card-cyber">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-container)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{t('settings.profile')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.profile_full_name')}</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)} className="input-cyber" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.profile_email')}</label>
                  <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="input-cyber" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => updateProfileMut.mutate({ full_name: profileName, email: profileEmail })}
                  disabled={updateProfileMut.isPending} className="btn-primary">
                  {updateProfileMut.isPending ? t('settings.profile_saving') : t('settings.profile_save')}
                </button>
                <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="btn-secondary">
                  {t('settings.profile_change_password')}
                </button>
              </div>
              {showPasswordForm && (
                <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.profile_current_password')}</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="input-cyber" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.profile_new_password')}</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-cyber" />
                    </div>
                  </div>
                  <button onClick={() => updatePasswordMut.mutate()}
                    disabled={updatePasswordMut.isPending} className="btn-secondary" style={{ background: 'var(--color-warning)', color: '#050B14', border: 'none' }}>
                    {updatePasswordMut.isPending ? t('settings.profile_updating') : t('settings.profile_update_password')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Users Tab ─── */}
      {activeTab === 'users' && (
        <div className="card-cyber p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{t('settings.user_management')}</h2>
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" /> {t('settings.create_user')}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder={t('settings.search_placeholder')} className="input-cyber pl-10" />
              </div>
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as UserRole | ''); setPage(1); }}
                className="input-cyber cursor-pointer appearance-none min-w-[140px]">
                <option value="">{t('settings.filter_all_roles')}</option>
                <option value="Manager">Manager</option>
                <option value="Admin">{t('common.role_admin')}</option>
                <option value="Doctor">{t('common.role_doctor')}</option>
                <option value="Receptionist">{t('common.role_receptionist')}</option>
                <option value="Assistant">Assistant</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                <div className="flex-[2]">{t('settings.table_user')}</div>
                <div className="flex-[1.5]">{t('settings.table_username')}</div>
                <div className="flex-[2]">{t('settings.table_email')}</div>
                <div className="flex-[1]">{t('settings.table_role')}</div>
                <div className="flex-[1]">{t('settings.branch')}</div>
                <div className="flex-[1]">{t('settings.table_status')}</div>
                <div className="w-28 text-right">{t('settings.table_actions')}</div>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>
                ) : paged.length === 0 ? (
                  <div className="py-16 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>
                    {searchQuery || roleFilter ? t('settings.empty_filters') : t('settings.empty_all')}
                  </div>
                ) : paged.map(u => (
                  <div key={u.id} className="flex items-center px-6 py-3.5 transition-all hover:bg-[var(--app-table-hover)]">
                    <div className="flex-[2] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'var(--color-primary-container)', border: '1px solid rgba(79,209,255,0.15)', color: 'var(--color-primary)' }}>
                        {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[var(--color-on-surface)]">{u.full_name}</span>
                    </div>
                    <div className="flex-[1.5] text-sm" style={{ color: 'var(--app-text-dim)' }}>{u.username}</div>
                    <div className="flex-[2] text-sm" style={{ color: 'var(--app-text-dim)' }}>{u.email || '\u2014'}</div>
                    <div className="flex-[1]">{roleBadge(u.role)}</div>
                    <div className="flex-[1] text-sm" style={{ color: 'var(--app-text-dim)' }}>
                      {u.branch_id ? branches.find(b => b.id === u.branch_id)?.name || '\u2014' : t('settings.no_branch')}
                    </div>
                    <div className="flex-[1]">
                      {u.is_active ? (
                        <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>{t('common.status_active')}</span>
                      ) : (
                        <span className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>{t('common.status_disabled')}</span>
                      )}
                    </div>
                    <div className="w-28 flex items-center justify-end gap-1">
                      <button onClick={() => { setShowEdit(u); setEditForm({ full_name: u.full_name, role: u.role, is_active: u.is_active, branch_id: u.branch_id || '' }); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(79,209,255,0.1)] hover:text-[var(--color-primary)]" style={{ color: 'var(--app-text-dim)' }}
                        title={t('common.edit')}>
                        <UserCog className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setShowPasswordReset(u)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(251,191,36,0.1)]" style={{ color: 'var(--app-text-dim)' }}
                        title={t('common.edit')}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {filtered.length > perPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>
                {t('common.showing_entries', { start: (page - 1) * perPage + 1, end: Math.min(page * perPage, filtered.length), total: filtered.length })}
              </span>
              <div className="flex items-center gap-1.5">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-dim)' }}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                  const n = idx + 1;
                  return <button key={n} onClick={() => setPage(n)}
                    className="w-8 h-8 rounded-lg text-xs font-semibold"
                    style={{ background: page === n ? 'var(--color-primary-container)' : 'transparent', border: `1px solid ${page === n ? 'rgba(79,209,255,0.2)' : 'var(--app-border)'}`, color: page === n ? 'var(--color-primary)' : 'var(--app-text-dim)' }}>{n}</button>;
                })}
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-dim)' }}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Notifications Tab ─── */}
      {activeTab === 'notifications' && (
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-container)' }}>
              <Bell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-on-surface)]">Notification Preferences</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--app-text-dim)' }}>Choose which notification categories you want to see in-app.</p>
          {prefsLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>Loading preferences...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries({
                appointment: { label: 'Appointments', icon: '\uD83D\uDCC5' },
                procedure: { label: 'Procedures', icon: '\uD83D\uDD2C' },
                invoice: { label: 'Invoices', icon: '\uD83D\uDCB0' },
                payment: { label: 'Payments', icon: '\uD83D\uDCB5' },
                inventory: { label: 'Inventory', icon: '\uD83D\uDCE6' },
                stock_request: { label: 'Stock Requests', icon: '\uD83D\uDD04' },
                delivery: { label: 'Deliveries', icon: '\uD83D\uDE9A' },
                follow_up: { label: 'Follow-ups', icon: '\uD83D\uDC89' },
                reminder: { label: 'Reminders', icon: '\uD83D\uDD14' },
                crm: { label: 'CRM', icon: '\uD83D\uDCAC' },
                system: { label: 'System', icon: '\u2699\uFE0F' },
                general: { label: 'General', icon: '\uD83D\uDCCB' },
              }).map(([cat, cfg]) => {
                const isEnabled = notificationPrefs[cat] !== false;
                return (
                  <div key={cat} className="flex items-center justify-between p-3 rounded-xl transition-all"
                    style={{ background: isEnabled ? 'var(--color-primary-container)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-sm font-medium" style={{ color: isEnabled ? 'var(--color-on-surface)' : 'var(--app-text-muted)' }}>{cfg.label}</span>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !isEnabled;
                        setNotificationPrefs(prev => ({ ...prev, [cat]: newVal }));
                        if (user?.id) notificationPreferenceService.upsert(user.id, cat as NotificationCategory, newVal);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: isEnabled ? 'var(--color-primary-container)' : 'var(--color-error-container)', color: isEnabled ? 'var(--color-primary)' : 'var(--color-error)' }}
                    >
                      {isEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Backup Tab ─── */}
      {activeTab === 'backup' && (
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-success-container)' }}>
              <Download className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-on-surface)]">Backup & Restore</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--app-text-dim)' }}>Export your data as JSON or Excel. Import previously exported data to restore.</p>
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
            }} className="btn-secondary btn-sm">
              <FileJson className="w-3.5 h-3.5" /> Export JSON
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
            }} className="btn-secondary btn-sm">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </button>
            <label className="btn-secondary btn-sm cursor-pointer">
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
                } catch { toast.error('Import failed \u2014 check file format'); }
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>
      )}

      {/* ─── System Tab ─── */}
      {activeTab === 'system' && (
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-secondary-container)' }}>
              <Shield className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-on-surface)]">{t('settings.system_info')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>{t('settings.version')}</span>
              <p className="text-sm font-medium mt-1 text-[var(--color-on-surface)]">1.0.0</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>{t('settings.environment')}</span>
              <p className="text-sm font-medium mt-1 text-[var(--color-on-surface)]">{t('app.env')}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>{t('settings.database')}</span>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-success)' }}>{t('app.db')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== CREATE USER MODAL ===== */}
      {showCreate && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{t('settings.modal_create_title')}</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_create_full_name')}</label>
                <input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder={t('settings.placeholder_full_name')} className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_create_username')}</label>
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  placeholder={t('settings.placeholder_username')} className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_create_email')}</label>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  type="text" placeholder={t('settings.placeholder_email')} className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_create_password')}</label>
                <div className="relative">
                  <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? 'text' : 'password'} placeholder={t('settings.placeholder_password')} className="input-cyber pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_create_role')}</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="input-cyber cursor-pointer appearance-none">
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                  <option value="Doctor">{t('common.role_doctor')}</option>
                  <option value="Receptionist">{t('common.role_receptionist')}</option>
                  <option value="Assistant">Assistant</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.branch')}</label>
                <select value={createForm.branch_id} onChange={e => setCreateForm(f => ({ ...f, branch_id: e.target.value }))}
                  className="input-cyber cursor-pointer appearance-none">
                  <option value="">{t('settings.no_branch')}</option>
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('settings.modal_create_cancel')}</button>
              <button onClick={() => {
                if (!createForm.full_name.trim() || !createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
                  toast.error(t('settings.toast_fields_required')); return;
                }
                if (createForm.password.length < 6) { toast.error(t('settings.toast_password_length')); return; }
                createMutation.mutate(createForm);
              }} disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? t('settings.modal_create_creating') : t('settings.modal_create_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== EDIT USER MODAL ===== */}
      {showEdit && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setShowEdit(null)}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{t('settings.modal_edit_title')}</h2>
              <button onClick={() => setShowEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--app-border)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                  {showEdit.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-on-surface)]">{showEdit.full_name}</div>
                  <div className="text-xs" style={{ color: 'var(--app-text-dim)' }}>{t('settings.modal_edit_user_info', { username: showEdit.username, email: showEdit.email || '\u2014' })}</div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_edit_full_name')}</label>
                <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_edit_role')}</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="input-cyber cursor-pointer appearance-none">
                  <option value="Manager">Manager</option>
                  <option value="Admin">{t('common.role_admin')}</option>
                  <option value="Doctor">{t('common.role_doctor')}</option>
                  <option value="Receptionist">{t('common.role_receptionist')}</option>
                  <option value="Assistant">Assistant</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.branch')}</label>
                <select value={editForm.branch_id} onChange={e => setEditForm(f => ({ ...f, branch_id: e.target.value }))}
                  className="input-cyber cursor-pointer appearance-none">
                  <option value="">{t('settings.no_branch')}</option>
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('settings.modal_edit_status')}</label>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === true}
                      onChange={() => setEditForm(f => ({ ...f, is_active: true }))} className="accent-[var(--color-success)]" />
                    <span style={{ color: 'var(--color-success)' }}>{t('settings.modal_edit_active')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="is_active" checked={editForm.is_active === false}
                      onChange={() => setEditForm(f => ({ ...f, is_active: false }))} className="accent-[var(--color-error)]" />
                    <span style={{ color: 'var(--color-error)' }}>{t('settings.modal_edit_disabled')}</span>
                  </label>
                </div>
                {!editForm.is_active && (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{t('settings.modal_edit_warning')}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setShowEdit(null)} className="btn-ghost">{t('settings.modal_edit_cancel')}</button>
              <button onClick={() => {
                if (!editForm.full_name.trim()) { toast.error(t('settings.toast_name_required')); return; }
                updateMutation.mutate({ id: showEdit.id, data: editForm });
              }} disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? t('settings.modal_edit_saving') : t('settings.modal_edit_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== PASSWORD RESET CONFIRMATION ===== */}
      {showPasswordReset && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setShowPasswordReset(null)}>
          <div className="w-full max-w-sm rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--color-warning-container)' }}>
                <svg className="w-6 h-6" style={{ color: 'var(--color-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[var(--color-on-surface)] text-center mb-2">{t('settings.modal_reset_title')}</h3>
              <p className="text-sm text-center" style={{ color: 'var(--app-text-dim)' }}>
                {t('settings.modal_reset_desc', { email: `${showPasswordReset.username}@trackimplant.local` })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setShowPasswordReset(null)} className="btn-ghost">{t('settings.modal_reset_cancel')}</button>
              <button onClick={() => resetPasswordMutation.mutate(`${showPasswordReset.username}@trackimplant.local`)} disabled={resetPasswordMutation.isPending}
                className="btn-sm" style={{ background: 'var(--color-warning)', color: '#050B14', border: 'none' }}>
                {resetPasswordMutation.isPending ? t('settings.modal_reset_sending') : t('settings.modal_reset_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}
    </div>
  );
}
