import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDebounce } from "../hooks/useDebounce";
import { searchService, type SearchResult } from "../services/searchService";
import { notificationService } from "../services/notificationService";
import AddPatientModal from "../components/AddPatientModal";
import {
  LayoutDashboard, Users, Activity, Calendar, CreditCard, Clock, Package, BarChart3,
  Bell, Search, Plus, Settings, LogOut, ChevronRight,
  User, FileText, Info, AlertTriangle, CheckCircle
} from "lucide-react";

function ToothLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4c-4 0-7 2.5-8.5 6.5S6 18 6 22c0 3 1.5 6 3.5 6s3.5-2.5 4.5-5c1-2.5 1-2.5 2-2.5s1 0 2 2.5c1 2.5 2.5 5 4.5 5s3.5-3 3.5-6c0-4-1-7-2.5-11.5S20 4 16 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const allNavItems: { path: string; labelKey: string; icon: React.ElementType; adminOnly?: boolean; hideForDoctor?: boolean }[] = [
  { path: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/dashboard/patients", labelKey: "nav.patients", icon: Users },
  { path: "/dashboard/cases", labelKey: "nav.tracking", icon: Activity },
  { path: "/dashboard/appointments", labelKey: "nav.appointments", icon: Calendar },
  { path: "/dashboard/payments", labelKey: "nav.finances", icon: CreditCard, hideForDoctor: true },
  { path: "/dashboard/follow-ups", labelKey: "nav.follow_ups", icon: Clock },
  { path: "/dashboard/reports", labelKey: "nav.reports", icon: BarChart3, hideForDoctor: true },
  { path: "/dashboard/inventory", labelKey: "nav.inventory", icon: Package, hideForDoctor: true },
  { path: "/dashboard/logs", labelKey: "nav.logs", icon: FileText, adminOnly: true },
];

const resultIcons: Record<string, React.ElementType> = {
  patient: User,
  procedure: Activity,
};

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 250);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.getByUser(user!.id, 10),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => notificationService.getUnreadCount(user!.id),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }); },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }); },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [notifOpen]);

  const notifColors: Record<string, { bg: string; icon: typeof Info; iconColor: string }> = {
    info: { bg: 'rgba(79,209,255,0.1)', icon: Info, iconColor: '#4FD1FF' },
    warning: { bg: 'rgba(255,193,7,0.1)', icon: AlertTriangle, iconColor: '#FFC107' },
    critical: { bg: 'rgba(239,68,68,0.1)', icon: AlertTriangle, iconColor: '#ef4444' },
    success: { bg: 'rgba(0,229,168,0.1)', icon: CheckCircle, iconColor: '#00E5A8' },
  };

  useEffect(() => {
    if (!debouncedQuery.trim()) return;
    searchService.searchAll(debouncedQuery).then(results => {
      setSearchResults(results);
      if (results.length > 0) setShowResults(true);
    });
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const selectResult = (r: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    navigate(r.url);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--app-bg)' }}>
      {/* Background tech grid + glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 'var(--z-base)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(79,209,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,209,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#4FD1FF] opacity-[0.03] rounded-full blur-[150px]" />
      </div>

      {/* ================= SIDEBAR ================= */}
      <aside className="relative w-[240px] flex flex-col flex-shrink-0" style={{ zIndex: 'var(--z-sidebar)', borderRight: '1px solid var(--app-border)', background: 'var(--app-sidebar-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-[rgba(255,255,255,0.04)]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.12)', border: '1px solid rgba(79,209,255,0.2)' }}>
            <ToothLogo className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-[#4FD1FF]" style={{ fontFamily: "'Inter','SF Pro Display',sans-serif" }}>{t('app.name')}</div>
            <div className="text-[9px] tracking-[0.2em] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('app.tagline')}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {allNavItems.filter(item => (!item.adminOnly || user?.role === 'Admin') && !(item.hideForDoctor && user?.role === 'Doctor')).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group"
                style={{
                  color: isActive ? '#4FD1FF' : 'rgba(255,255,255,0.6)',
                  background: isActive ? 'rgba(79,209,255,0.1)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(79,209,255,0.06)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: '#4FD1FF', boxShadow: '0 0 8px rgba(79,209,255,0.5)' }} />
                )}
                <Icon className="w-[18px] h-[18px]" style={{ opacity: isActive ? 1 : 0.6 }} />
                <span>{t(item.labelKey)}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* New Procedure Button */}
        <div className="px-4 mb-4">
          <button
            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
              color: '#050B14',
              boxShadow: '0 4px 20px rgba(69,214,255,0.2)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 30px rgba(69,214,255,0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(69,214,255,0.2)'}
          >
            <Plus className="w-4 h-4" />
            {t('nav.new_procedure')}
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="px-3 pb-4 space-y-0.5 border-t border-[rgba(255,255,255,0.04)] pt-3">
          {user?.role === 'Admin' && (
            <Link to="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Settings className="w-[18px] h-[18px]" />
              <span>{t('nav.settings')}</span>
            </Link>
          )}
          {user?.role === 'Admin' && (
            <Link to="/dashboard/logs" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <FileText className="w-[18px] h-[18px]" />
              <span>{t('nav.audit_logs')}</span>
            </Link>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm w-full text-left transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN AREA ================= */}
      <div className="relative flex-1 flex flex-col min-w-0" style={{ zIndex: 'var(--z-content)' }}>

        {/* Top Navbar */}
        <header className="h-16 flex items-center gap-4 px-6" style={{ position: 'relative', zIndex: 'var(--z-header)', borderBottom: '1px solid var(--app-border)', background: 'var(--app-header-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          
          {/* Search Bar with suggestions */}
          <div ref={searchRef} className="flex-1 max-w-lg relative">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: searchFocused ? '#4FD1FF' : 'rgba(255,255,255,0.25)' }} />
              <input
                type="text"
                placeholder={t('nav.search_placeholder')}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) { setSearchResults([]); setShowResults(false); } if (e.target.value) setShowResults(true); }}
                onFocus={() => { setSearchFocused(true); if (searchResults.length) setShowResults(true); }}
                className="w-full h-10 pl-10 pr-16 rounded-xl text-sm outline-none transition-all duration-200 placeholder-gray-500"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: searchFocused ? '1px solid rgba(79,209,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                ⌘K
              </kbd>
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden"
                style={{
                  zIndex: 'var(--z-dropdown)',
                  background: 'rgba(8,15,25,0.98)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}>
                {searchResults.length === 0 ? (
                  <div className="px-4 py-4 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {searchQuery ? t('nav.no_results') : t('nav.start_typing')}
                  </div>
                ) : (
                  <div>
                    {(['patient', 'procedure'] as const).map(type => {
                      const items = searchResults.filter(r => r.type === type);
                      if (items.length === 0) return null;
                      const Icon = resultIcons[type];
                      return (
                        <div key={type}>
                          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b border-[rgba(255,255,255,0.04)]"
                            style={{ color: 'rgba(255,255,255,0.2)' }}>
                            {type === 'patient' ? t('nav.patients_group') : t('nav.procedures_group')}
                          </div>
                          {items.map(r => (
                            <button key={`${type}-${r.id}`}
                              onClick={() => selectResult(r)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-[rgba(79,209,255,0.06)]">
                              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#4FD1FF' }} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-white truncate">{r.label}</div>
                                <div className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.subtitle}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell with Dropdown */}
            <div ref={notifRef} className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                style={{ background: notifOpen ? 'rgba(79,209,255,0.1)' : 'rgba(255,255,255,0.03)', border: notifOpen ? '1px solid rgba(79,209,255,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <Bell className="w-[18px] h-[18px]" style={{ color: notifOpen ? '#4FD1FF' : 'rgba(255,255,255,0.6)' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: '#4FD1FF', color: '#050B14', boxShadow: '0 0 8px rgba(79,209,255,0.6)' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {notifOpen && (
                <div className="absolute top-full right-0 mt-2 w-[380px] rounded-2xl overflow-hidden"
                  style={{
                    zIndex: 'var(--z-notification)',
                    background: 'rgba(10,20,35,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(16px)',
                  }}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
                    <div>
                      <span className="text-sm font-semibold text-white">{t('notifications.title')}</span>
                      <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('notifications.subtitle', { unread: unreadCount, total: notifications.length })}</span>
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllMut.mutate()} className="text-[11px] font-medium" style={{ color: '#4FD1FF' }}>
                        {t('notifications.mark_all_read')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('notifications.empty')}</div>
                    ) : notifications.map(n => {
                      const nc = notifColors[n.type] || notifColors.info;
                      const NIcon = nc.icon;
                      return (
                        <div key={n.id}
                          className="flex items-start gap-3 px-5 py-3.5 transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                          style={{ opacity: n.is_read ? 0.6 : 1 }}
                          onClick={() => { if (!n.is_read) markReadMut.mutate(n.id); if (n.link) navigate(n.link); setNotifOpen(false); }}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: nc.bg }}>
                            <NIcon className="w-4 h-4" style={{ color: nc.iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{n.title}</div>
                            <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{n.message}</div>
                            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {n.created_at ? new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                          {!n.is_read && <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#4FD1FF' }} />}
                        </div>
                      );
                    })}
                  </div>
                  <Link to="/dashboard/notifications" onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-center py-3 text-xs font-medium border-t border-[rgba(255,255,255,0.05)] transition-all hover:bg-[rgba(79,209,255,0.04)]"
                    style={{ color: '#4FD1FF' }}>
                    {t('notifications.view_all')}
                  </Link>
                </div>
              )}
            </div>

            {/* Add Patient */}
            <button
              onClick={() => setAddPatientOpen(true)}
              className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
                color: '#050B14',
                boxShadow: '0 4px 15px rgba(69,214,255,0.2)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 25px rgba(69,214,255,0.35)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 15px rgba(69,214,255,0.2)'}
            >
              <Plus className="w-4 h-4" />
              {t('nav.add_patient')}
            </button>

            {/* Role Debug */}
            <div className="text-[10px] font-mono px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {t('nav.role')} <span className="text-[#4FD1FF] font-bold">{user?.role || t('nav.na')}</span>
            </div>

            {/* Profile */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(79,209,255,0.2), rgba(79,209,255,0.1))', border: '1px solid rgba(79,209,255,0.2)', color: '#4FD1FF' }}
              title={user?.full_name || user?.username}>
              {(user?.full_name || user?.username || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Add Patient Modal */}
      <AddPatientModal isOpen={addPatientOpen} onClose={() => setAddPatientOpen(false)} />
    </div>
  );
}
