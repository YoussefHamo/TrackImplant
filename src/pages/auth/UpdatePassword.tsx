import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

function MedicalCrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="6" width="8" height="28" rx="2" fill="currentColor" />
      <rect x="6" y="16" width="28" height="8" rx="2" fill="currentColor" />
    </svg>
  );
}

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    // 1. Read tokens from URL hash manually (handles cross-origin sessions
    //    where Supabase's auto‑read may not work, e.g. localhost vs ngrok)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        // Clean URL immediately so nothing re-processes
        window.history.replaceState(null, '', window.location.pathname);

        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (cancelled) return;
          setRecoveryMode(error ? 'invalid' : 'ready');
        });
        return; // no need for fallback listeners
      }
    }

    // No tokens in URL — clean up and fall back to getSession
    window.history.replaceState(null, '', window.location.pathname);

    // 2. Try existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        setRecoveryMode('ready');
      }
    });

    // 3. Backup listener for PASSWORD_RECOVERY event
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setRecoveryMode('ready');
      }
    });
    subscription = sub.data.subscription;

    // 4. Fallback — 10s then show expired
    const fallback = setTimeout(() => {
      if (cancelled) return;
      setRecoveryMode((prev) => (prev === 'loading' ? 'invalid' : prev));
    }, 10000);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetail('');

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorDetail(`Server said: ${error.message} (status: ${(error as any)?.status || 'N/A'})`);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Sign out to kill the temp recovery session completely
    await supabase.auth.signOut();

    toast.success('Password updated successfully');
    setLoading(false);
    setTimeout(() => navigate('/login'), 2000);
  };

  if (recoveryMode === 'loading') {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#06142B] to-[#0B1F3A] z-0" />
        <div className="relative z-10 w-full max-w-md">
          <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/30 via-transparent to-[#4FD1FF]/10 blur-[2px]" />
          <div className="absolute -inset-[2px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/15 via-transparent to-[#4FD1FF]/5" />
          <div className="relative w-full rounded-[24px] p-16 text-center"
            style={{
              background: 'rgba(17, 25, 40, 0.75)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <div className="w-10 h-10 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Verifying your recovery link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (recoveryMode === 'invalid') {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#06142B] to-[#0B1F3A] z-0" />
        <div className="relative z-10 w-full max-w-md">
          <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/30 via-transparent to-[#4FD1FF]/10 blur-[2px]" />
          <div className="absolute -inset-[2px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/15 via-transparent to-[#4FD1FF]/5" />
          <div className="relative w-full rounded-[24px] p-8 sm:p-10 text-center"
            style={{
              background: 'rgba(17, 25, 40, 0.75)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-5">
              <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold text-white mb-3">Invalid or Expired Link</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link to="/forgot-password"
              className="inline-flex items-center justify-center mt-6 h-11 px-6 rounded-xl text-sm font-bold transition-all duration-300 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#07121F', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#06142B] to-[#0B1F3A] z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4FD1FF] opacity-[0.04] rounded-full blur-[120px] z-0" />
      <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-72 h-48 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute top-[30%] right-[8%] w-96 h-56 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute bottom-[20%] left-[15%] w-80 h-40 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute bottom-[10%] right-[20%] w-64 h-36 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/30 via-transparent to-[#4FD1FF]/10 blur-[2px]" />
        <div className="absolute -inset-[2px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/15 via-transparent to-[#4FD1FF]/5" />

        <div
          className="relative w-full rounded-[24px] p-8 sm:p-10"
          style={{
            background: 'rgba(17, 25, 40, 0.75)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 mb-5">
              <MedicalCrossIcon className="w-7 h-7 text-[#4FD1FF]" />
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight text-white">
              Set New Password
            </h1>
            <p className="text-xs tracking-[0.25em] uppercase mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Must be at least 6 characters
            </p>
          </div>

          {errorDetail && (
            <div className="p-3 rounded-xl text-xs break-all bg-red-950/30 border border-red-500/30 text-red-400 mb-4">
              {errorDetail}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-5">
            <div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#4FD1FF] transition-colors duration-300">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full h-[50px] pl-11 pr-11 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-[0_0_20px_rgba(79,209,255,0.08)]"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    caretColor: '#4FD1FF',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(79,209,255,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-[50px] rounded-xl font-bold text-sm tracking-wide overflow-hidden transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
                color: '#07121F',
                boxShadow: '0 4px 20px rgba(69,214,255,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(69,214,255,0.4)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(69,214,255,0.25)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#07121F] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Update Password &rarr;</>
                )}
              </span>
            </button>
          </form>

          <div className="text-center mt-6">
            <Link to="/" className="text-xs font-medium transition-all duration-200 hover:brightness-125" style={{ color: '#4FD1FF' }}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
