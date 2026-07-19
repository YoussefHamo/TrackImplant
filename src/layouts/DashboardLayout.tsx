import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { useLanguage } from "../context/LanguageContext";
import { useDebounce } from "../hooks/useDebounce";
import { searchService, type SearchResult } from "../services/searchService";
import { notificationService } from "../services/notificationService";
import AddPatientModal from "../components/AddPatientModal";
import {
  LayoutDashboard, Users, Activity, Calendar, CreditCard, Package, BarChart3,
  Bell, Search, Plus, Settings, LogOut, ChevronRight,
  User, FileText, Info, AlertTriangle, CheckCircle, Menu, X,
  Stethoscope, Building2, ChevronDown, Shield,
  PanelLeftClose, PanelLeft
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  hideForDoctor?: boolean;
  hideForRole?: UserRole[];
  badge?: 'unread';
  group: 'primary' | 'operations' | 'admin';
}

type UserRole = 'Admin' | 'Manager' | 'Doctor' | 'Receptionist' | 'Assistant';

interface NavGroup {
  id: string;
  labelKey: string;
  labelDefault: string;
  items: NavItem[];
}

// ─── Nav Data ────────────────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'primary',
    labelKey: 'nav.group_clinical',
    labelDefault: 'Clinical',
    items: [
      { path: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, group: 'primary' },
      { path: "/dashboard/schedule", labelKey: "nav.schedule", icon: Calendar, group: 'primary' },
      { path: "/dashboard/patients", labelKey: "nav.patients", icon: Users, group: 'primary' },
      { path: "/dashboard/cases", labelKey: "nav.tracking", icon: Stethoscope, group: 'primary' },
      { path: "/dashboard/follow-ups", labelKey: "nav.follow_ups", icon: Activity, group: 'primary' },
    ],
  },
  {
    id: 'operations',
    labelKey: 'nav.group_operations',
    labelDefault: 'Operations',
    items: [
      { path: "/dashboard/inventory", labelKey: "nav.inventory", icon: Package, group: 'operations', hideForDoctor: true },
      { path: "/dashboard/payments", labelKey: "nav.finances", icon: CreditCard, group: 'operations', hideForDoctor: true },
      { path: "/dashboard/reports", labelKey: "nav.reports", icon: BarChart3, group: 'operations', hideForDoctor: true },
      { path: "/dashboard/notifications", labelKey: "nav.notifications", icon: Bell, group: 'operations', badge: 'unread' },
    ],
  },
  {
    id: 'admin',
    labelKey: 'nav.group_admin',
    labelDefault: 'Administration',
    items: [
      { path: "/dashboard/logs", labelKey: "nav.logs", icon: FileText, group: 'admin', adminOnly: true },
      { path: "/dashboard/settings", labelKey: "nav.settings", icon: Settings, group: 'admin', adminOnly: true },
    ],
  },
];

const resultIcons: Record<string, React.ElementType> = {
  patient: User,
  procedure: Activity,
};

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  Admin: '#4FD1FF',
  Manager: '#7C5CFF',
  Doctor: '#34D399',
  Receptionist: '#FBBF24',
  Assistant: '#F43F5E',
};

const ROLE_BADGE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  Manager: 'Manager',
  Doctor: 'Doctor',
  Receptionist: 'Reception',
  Assistant: 'Asst.',
};

const STATUS_COLORS: Record<string, string> = {
  info: '#4FD1FF',
  warning: '#FFC107',
  critical: '#ef4444',
  success: '#00E5A8',
};

const STATUS_BG: Record<string, string> = {
  info: 'rgba(79,209,255,0.1)',
  warning: 'rgba(255,193,7,0.1)',
  critical: 'rgba(239,68,68,0.1)',
  success: 'rgba(0,229,168,0.1)',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Dental tooth logo SVG – kept from original */
function ToothLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4c-4 0-7 2.5-8.5 6.5S6 18 6 22c0 3 1.5 6 3.5 6s3.5-2.5 4.5-5c1-2.5 1-2.5 2-2.5s1 0 2 2.5c1 2.5 2.5 5 4.5 5s3.5-3 3.5-6c0-4-1-7-2.5-11.5S20 4 16 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Branch selector dropdown — Admin only, inline in header */
function BranchSelector() {
  const { activeBranchId, setActiveBranchId, availableBranches, branchLoading, currentBranchName } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [open]);

  if (branchLoading || availableBranches.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
        <div className="w-3 h-3 rounded-full border border-current animate-spin border-t-transparent" />
        Loading...
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Select branch"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-medium transition-all duration-normal ease-out-expo"
        style={{
          background: open ? 'rgba(79,209,255,0.1)' : 'rgba(255,255,255,0.03)',
          border: open ? '1px solid rgba(79,209,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
          color: open ? '#4FD1FF' : 'rgba(255,255,255,0.6)',
        }}
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline text-[10px] uppercase tracking-wider opacity-50 mr-0.5">Branch:</span>
        <span className="text-xs max-w-[100px] truncate">{currentBranchName || 'Select branch'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-normal ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-[220px] rounded-xl overflow-hidden py-1"
          role="listbox"
          aria-label="Available branches"
          style={{
            zIndex: 'var(--z-dropdown)',
            background: 'rgba(10,20,35,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(16px)',
          }}>
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Switch Branch
          </div>
          {availableBranches.map(b => (
            <button
              key={b.id}
              role="option"
              aria-selected={b.id === activeBranchId}
              onClick={() => { setActiveBranchId(b.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all duration-normal ease-out-expo"
              style={{
                color: b.id === activeBranchId ? '#4FD1FF' : 'rgba(255,255,255,0.7)',
                background: b.id === activeBranchId ? 'rgba(79,209,255,0.08)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (b.id !== activeBranchId) e.currentTarget.style.background = 'rgba(79,209,255,0.04)'; }}
              onMouseLeave={(e) => { if (b.id !== activeBranchId) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.id === activeBranchId ? '' : 'opacity-0'}`}
                style={{ background: '#4FD1FF', boxShadow: b.id === activeBranchId ? '0 0 6px rgba(79,209,255,0.6)' : 'none' }} />
              <span>{b.name}</span>
              {b.id === activeBranchId && (
                <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Avatar initials component */
function Avatar({ name, size = 'md', className = '' }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : '?';
  const dims = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 sm:w-10 sm:h-10 text-sm';
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(79,209,255,0.2), rgba(79,209,255,0.1))',
        border: '1px solid rgba(79,209,255,0.2)',
        color: '#4FD1FF',
      }}
    >
      {initials}
    </div>
  );
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
    catch { return false; }
  });

  // ── Search state ──
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 250);

  // ── Notification dropdown state ──
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Modal state ──
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  // ── Profile dropdown state ──
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Queries ──
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  // ── Side effects ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [notifOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    if (profileOpen) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [profileOpen]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

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

  // ── Handlers ──
  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); }
      catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate("/");
  }, [signOut, navigate]);

  const selectResult = useCallback((r: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    setProfileOpen(false);
    navigate(r.url);
  }, [navigate]);

  // ── Filtered nav items ──
  const visibleGroups = useMemo(() => {
    const role = user?.role as UserRole | undefined;
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && role !== 'Admin') return false;
        if (item.hideForDoctor && role === 'Doctor') return false;
        if (item.hideForRole && role && item.hideForRole.includes(role)) return false;
        return true;
      }),
    })).filter(g => g.items.length > 0);
  }, [user?.role]);

  // ── Unread count for notifications nav item ──
  const navUnread = unreadCount;

  // ── Render ──
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--app-bg)' }}>
      {/* ── Ambient background effects ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 'var(--z-base)' }}>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(79,209,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,209,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-[#4FD1FF] opacity-[0.02] rounded-full blur-[180px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#7C5CFF] opacity-[0.015] rounded-full blur-[150px]" />
      </div>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ═══════════════════════════ SIDEBAR ═══════════════════════════ */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`
          fixed lg:relative inset-y-0 left-0 z-40 flex flex-col h-full
          glass-strong
          transition-transform duration-300 ease-out-expo
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          width: sidebarCollapsed ? '68px' : '256px',
          transition: 'width 250ms var(--ease-out-expo), transform 300ms var(--ease-out-expo)',
          borderRight: '1px solid var(--app-border)',
          overflow: 'hidden',
        }}
      >
        {/* ── Close button (mobile) ── */}
        <div className="absolute top-3 right-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Logo area ── */}
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{
            height: '64px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            minWidth: sidebarCollapsed ? '68px' : '256px',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(79,209,255,0.15), rgba(79,209,255,0.05))',
              border: '1px solid rgba(79,209,255,0.2)',
              boxShadow: '0 0 20px rgba(79,209,255,0.08)',
            }}
          >
            <ToothLogo className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div className={`overflow-hidden transition-all duration-250 ease-out-expo ${sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <div className="text-sm font-semibold tracking-tight text-[#4FD1FF] whitespace-nowrap" style={{ fontFamily: "'Inter','SF Pro Display',sans-serif" }}>
              {t('app.name')}
            </div>
            <div className="text-[9px] tracking-[0.2em] font-medium whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t('app.tagline')}
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin"
          style={{ scrollbarWidth: 'thin' }}>
          {visibleGroups.map((group) => (
            <div key={group.id} className="mb-5 last:mb-0">
              {/* Section label */}
              <div
                className={`flex items-center px-3 mb-2 transition-all duration-200 ease-out-expo ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.15em] transition-all duration-200 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
                  }`}
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  {t(group.labelKey, group.labelDefault)}
                </span>
                {sidebarCollapsed && (
                  <span className="w-5 h-px rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                )}
              </div>

              {/* Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                  const showBadge = item.badge === 'unread' && navUnread > 0;

                  return (
                    <div key={item.path} className="relative group">
                      <Link
                        to={item.path}
                        aria-label={t(item.labelKey)}
                        aria-current={isActive ? 'page' : undefined}
                        tabIndex={0}
                        className={`
                          flex items-center gap-3 rounded-xl text-sm font-medium
                          transition-all duration-normal ease-out-expo
                          focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4FD1FF]/50
                          ${sidebarCollapsed ? 'justify-center px-0 py-3 mx-auto w-11 h-11' : 'px-4 py-2.5'}
                        `}
                        style={{
                          width: sidebarCollapsed ? '44px' : '100%',
                          color: isActive ? '#4FD1FF' : 'rgba(255,255,255,0.55)',
                          background: isActive
                            ? 'rgba(79,209,255,0.1)'
                            : 'transparent',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(79,209,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <span
                            className="absolute rounded-r-full transition-all duration-normal ease-out-expo"
                            style={{
                              left: 0,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '3px',
                              height: sidebarCollapsed ? '24px' : '20px',
                              background: '#4FD1FF',
                              boxShadow: '0 0 8px rgba(79,209,255,0.5)',
                            }}
                          />
                        )}

                        {/* Icon */}
                        <div className="relative shrink-0">
                          <Icon className={sidebarCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'} style={{ opacity: isActive ? 1 : 0.65 }} />
                          {showBadge && (
                            <span
                              className="absolute -top-1.5 -right-1.5 min-w-[8px] h-2 rounded-full"
                              style={{ background: '#4FD1FF', boxShadow: '0 0 6px rgba(79,209,255,0.6)' }}
                            />
                          )}
                        </div>

                        {/* Label */}
                        <span className={`transition-all duration-200 ease-out-expo overflow-hidden whitespace-nowrap ${
                          sidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'
                        }`}>
                          {t(item.labelKey)}
                        </span>

                        {/* Active chevron */}
                        {isActive && !sidebarCollapsed && (
                          <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ opacity: 0.4 }} />
                        )}
                      </Link>

                      {/* ── Tooltip (collapsed state) ── */}
                      {sidebarCollapsed && (
                        <div
                          className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-150 ease-out-expo"
                          style={{
                            background: 'rgba(0,0,0,0.92)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            zIndex: 'var(--z-tooltip)',
                            backdropFilter: 'blur(8px)',
                          }}
                          role="tooltip"
                        >
                          {t(item.labelKey)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer: User info + Logout + Collapse ── */}
        <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {/* User info */}
          <div className={`flex items-center px-3 py-3 transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="relative group shrink-0">
              <Avatar name={user?.full_name || user?.username || ''} size="sm" />
              {/* Tooltip for collapsed */}
              {sidebarCollapsed && (
                <div
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                    transition-all duration-150 ease-out-expo"
                  style={{
                    background: 'rgba(0,0,0,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    zIndex: 'var(--z-tooltip)',
                    backdropFilter: 'blur(8px)',
                  }}
                  role="tooltip"
                >
                  <div className="text-xs font-semibold">{user?.full_name || user?.username || 'User'}</div>
                  <div className="text-[10px] mt-0.5 opacity-60">{user?.role || ''}</div>
                </div>
              )}
            </div>

            <div className={`flex-1 min-w-0 transition-all duration-200 overflow-hidden ${
              sidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'
            }`}>
              <div className="text-xs font-medium text-white truncate">{user?.full_name || user?.username || 'User'}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: `${ROLE_BADGE_COLORS[user?.role as UserRole] || '#666'}22`,
                    color: ROLE_BADGE_COLORS[user?.role as UserRole] || '#999',
                    border: `1px solid ${ROLE_BADGE_COLORS[user?.role as UserRole] || '#666'}33`,
                  }}
                >
                  {ROLE_BADGE_LABELS[user?.role as UserRole] || user?.role || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions row */}
          <div className={`flex items-center px-2 pb-3 gap-1 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            {/* Logout */}
            <button
              onClick={handleLogout}
              className={`
                flex items-center gap-2 rounded-xl text-xs font-medium transition-all duration-normal ease-out-expo
                hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444]
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ef4444]/50
                ${sidebarCollapsed
                  ? 'justify-center w-11 h-11 p-0 text-[rgba(255,255,255,0.3)]'
                  : 'flex-1 px-3 py-2 text-[rgba(255,255,255,0.35)]'}
              `}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="w-[16px] h-[16px] shrink-0" />
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${
                sidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'
              }`}>
                {t('nav.logout')}
              </span>
            </button>

            {/* Collapse toggle */}
            <button
              onClick={toggleCollapsed}
              className={`
                flex items-center justify-center rounded-xl transition-all duration-normal ease-out-expo
                hover:bg-[rgba(255,255,255,0.05)] hover:text-white
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4FD1FF]/50
                ${sidebarCollapsed
                  ? 'w-11 h-11 p-0 text-[rgba(255,255,255,0.25)]'
                  : 'w-8 h-8 p-0 text-[rgba(255,255,255,0.2)]'}
              `}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════ MAIN AREA ═══════════════════════════ */}
      <div className="relative flex-1 flex flex-col min-w-0" style={{ zIndex: 'var(--z-content)' }}>

        {/* ── HEADER ── */}
        <header
          className="h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 shrink-0"
          style={{
            position: 'relative',
            zIndex: 'var(--z-header)',
            borderBottom: '1px solid var(--app-border)',
            background: 'var(--app-header-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <div ref={searchRef} className="flex-1 max-w-lg relative hidden sm:block">
            <div className="relative group">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-normal"
                style={{ color: searchFocused ? '#4FD1FF' : 'rgba(255,255,255,0.25)' }}
              />
              <input
                type="text"
                role="searchbox"
                aria-label="Search patients, ID, or phone"
                placeholder={t('nav.search_placeholder')}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) { setSearchResults([]); setShowResults(false); } if (e.target.value) setShowResults(true); }}
                onFocus={() => { setSearchFocused(true); if (searchResults.length) setShowResults(true); }}
                className="w-full h-10 pl-10 pr-16 rounded-xl text-sm outline-none transition-all duration-normal ease-out-expo placeholder-gray-500 input-cyber"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: searchFocused ? '1px solid rgba(79,209,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <kbd
                className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide pointer-events-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                ⌘K
              </kbd>
            </div>

            {/* Search results dropdown */}
            {showResults && (
              <div
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden"
                style={{
                  zIndex: 'var(--z-dropdown)',
                  background: 'rgba(8,15,25,0.98)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(16px)',
                }}
                role="listbox"
                aria-label="Search results"
              >
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
                          <div
                            className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                            style={{ color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.04)' }}
                          >
                            {type === 'patient' ? t('nav.patients_group') : t('nav.procedures_group')}
                          </div>
                          {items.map(r => (
                            <button
                              key={`${type}-${r.id}`}
                              role="option"
                              aria-selected={false}
                              onClick={() => selectResult(r)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-normal ease-out-expo hover:bg-[rgba(79,209,255,0.06)] focus-visible:outline-none focus-visible:bg-[rgba(79,209,255,0.06)]"
                            >
                              <Icon className="w-4 h-4 shrink-0" style={{ color: '#4FD1FF' }} />
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

          {/* Mobile search icon */}
          <button
            className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Spacer */}
          <div className="flex-1 sm:hidden" />

          {/* Branch selector (Admin only) */}
          {user?.role === 'Admin' && (
            <div className="hidden sm:block">
              <BranchSelector />
            </div>
          )}

          {/* ── Right actions ── */}
          <div className="flex items-center gap-1 sm:gap-2">

            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(o => !o)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={notifOpen}
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-normal ease-out-expo"
                style={{
                  background: notifOpen ? 'rgba(79,209,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: notifOpen ? '1px solid rgba(79,209,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Bell className="w-[18px] h-[18px]" style={{ color: notifOpen ? '#4FD1FF' : 'rgba(255,255,255,0.6)' }} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: '#4FD1FF',
                      color: '#050B14',
                      boxShadow: '0 0 8px rgba(79,209,255,0.6)',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-[340px] sm:w-[380px] rounded-2xl overflow-hidden"
                  style={{
                    zIndex: 'var(--z-notification)',
                    background: 'rgba(10,20,35,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(16px)',
                  }}
                  role="menu"
                  aria-label="Notifications"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div>
                      <span className="text-sm font-semibold text-white">{t('notifications.title')}</span>
                      <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {unreadCount > 0
                          ? `${unreadCount} unread`
                          : 'All caught up'}
                      </span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllMut.mutate()}
                        className="text-[11px] font-medium transition-colors hover:brightness-125"
                        style={{ color: '#4FD1FF' }}
                      >
                        {t('notifications.mark_all_read')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        {t('notifications.empty')}
                      </div>
                    ) : notifications.map(n => {
                      const NIcon = INFO_ICONS[n.type] || Info;
                      const ncBg = STATUS_BG[n.type] || STATUS_BG.info;
                      const ncColor = STATUS_COLORS[n.type] || STATUS_COLORS.info;
                      return (
                        <div
                          key={n.id}
                          role="menuitem"
                          className="flex items-start gap-3 px-5 py-3.5 transition-all duration-normal cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                          style={{ opacity: n.is_read ? 0.55 : 1 }}
                          onClick={() => {
                            if (!n.is_read) markReadMut.mutate(n.id);
                            if (n.link) navigate(n.link);
                            setNotifOpen(false);
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: ncBg }}
                          >
                            <NIcon className="w-4 h-4" style={{ color: ncColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{n.title}</div>
                            <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{n.message}</div>
                            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {n.created_at ? new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#4FD1FF', boxShadow: '0 0 6px rgba(79,209,255,0.5)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Link
                    to="/dashboard/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-center py-3 text-xs font-medium border-t transition-all duration-normal hover:bg-[rgba(79,209,255,0.04)]"
                    style={{ color: '#4FD1FF', borderColor: 'rgba(255,255,255,0.05)' }}
                  >
                    {t('notifications.view_all')}
                  </Link>
                </div>
              )}
            </div>

            {/* Add Patient button */}
            <button
              onClick={() => setAddPatientOpen(true)}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-normal ease-out-expo active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
                color: '#050B14',
                boxShadow: '0 4px 15px rgba(69,214,255,0.2)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 25px rgba(69,214,255,0.35)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 15px rgba(69,214,255,0.2)'}
              aria-label="Add new patient"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.add_patient')}</span>
            </button>

            {/* Role badge — hidden on mobile */}
            <div
              className="hidden md:flex items-center gap-2 text-[10px] font-mono px-2.5 py-1 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {user?.full_name && (
                <span className="text-white/70 max-w-[80px] truncate">{user.full_name}</span>
              )}
              <span
                className="font-bold"
                style={{ color: ROLE_BADGE_COLORS[user?.role as UserRole] || '#4FD1FF' }}
              >
                {ROLE_BADGE_LABELS[user?.role as UserRole] || user?.role || 'N/A'}
              </span>
            </div>

            {/* Profile avatar with dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(o => !o)}
                aria-label="User menu"
                aria-expanded={profileOpen}
                className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4FD1FF]/50 rounded-full"
              >
                <Avatar name={user?.full_name || user?.username || ''} />
              </button>

              {profileOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-[220px] rounded-xl overflow-hidden py-1"
                  style={{
                    zIndex: 'var(--z-dropdown)',
                    background: 'rgba(10,20,35,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(16px)',
                  }}
                  role="menu"
                  aria-label="User menu"
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="text-sm font-semibold text-white truncate">{user?.full_name || user?.username || 'User'}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Shield className="w-3 h-3" style={{ color: ROLE_BADGE_COLORS[user?.role as UserRole] }} />
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {user?.role || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  {user?.role === 'Admin' && (
                    <Link
                      to="/dashboard/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-normal hover:bg-[rgba(79,209,255,0.06)]"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      role="menuitem"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      {t('nav.settings')}
                    </Link>
                  )}

                  <Link
                    to="/dashboard/notifications"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-normal hover:bg-[rgba(79,209,255,0.06)]"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                    role="menuitem"
                  >
                    <Bell className="w-4 h-4 shrink-0" />
                    {t('nav.notifications')}
                    {unreadCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#4FD1FF', color: '#050B14' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* Divider */}
                  <div className="my-1 mx-3 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} role="separator" />

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-all duration-normal hover:bg-[rgba(239,68,68,0.08)]"
                    style={{ color: 'rgba(239,68,68,0.7)' }}
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* ── Add Patient Modal ── */}
      <AddPatientModal isOpen={addPatientOpen} onClose={() => setAddPatientOpen(false)} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INFO_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
  success: CheckCircle,
};
