import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { Lock, User, Eye, EyeOff, Fingerprint } from 'lucide-react';

const authSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AuthForm = z.infer<typeof authSchema>;

function MedicalCrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="16" y="6" width="8" height="28" rx="2" fill="currentColor" />
      <rect x="6" y="16" width="28" height="8" rx="2" fill="currentColor" />
    </svg>
  );
}

export const Login = () => {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remembered_identifier'));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
  });

  useEffect(() => {
    const stored = localStorage.getItem('remembered_identifier');
    if (stored) setValue('identifier', stored);
  }, [setValue]);

  const onSubmit = async (data: AuthForm) => {
    if (rememberMe) {
      localStorage.setItem('remembered_identifier', data.identifier);
    } else {
      localStorage.removeItem('remembered_identifier');
    }
    const { error } = await signIn(data.identifier, data.password);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Access granted');
      setTimeout(() => navigate('/dashboard'), 0);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050B18] via-[#081525] to-[#0D1B2A] z-0" />

      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#4FD1FF] opacity-[0.03] rounded-full blur-[120px] z-0" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-[#7C5CFF] opacity-[0.025] rounded-full blur-[120px] z-0" aria-hidden="true" />

      {/* Animated grid pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" aria-hidden="true">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loginGrid" patternUnits="userSpaceOnUse" width="40" height="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(79,209,255,0.3)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>
      </div>

      {/* Main card */}
      <div
        className={`relative z-10 w-full max-w-[420px] transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Outer glow rings */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/25 via-transparent to-[#7C5CFF]/15 blur-[3px]" aria-hidden="true" />
        <div className="absolute -inset-[2px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/10 via-transparent to-[#7C5CFF]/5" aria-hidden="true" />

        <div
          className="relative w-full rounded-[24px] p-8 sm:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
          style={{
            background: 'rgba(13, 22, 36, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Brand */}
          <div className="text-center mb-9">
            <div
              className={`inline-flex items-center justify-center w-[60px] h-[60px] rounded-2xl transition-all duration-700 delay-[100ms] ease-out ${
                mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              }`}
              style={{ background: 'rgba(79,209,255,0.08)', border: '1px solid rgba(79,209,255,0.15)' }}
            >
              <MedicalCrossIcon className="w-[30px] h-[30px] text-[#4FD1FF]" />
            </div>
            <h1
              className={`text-[30px] font-bold tracking-tight mt-4 transition-all duration-700 delay-[200ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ color: '#4FD1FF' }}
            >
              TrackImplant
            </h1>
            <p
              className={`text-[11px] tracking-[0.35em] uppercase mt-1.5 font-medium transition-all duration-700 delay-[300ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Dental Implant Management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-[18px]">
            {/* Identifier field */}
            <div
              className={`transition-all duration-700 delay-[400ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <label htmlFor="identifier" className="sr-only">Username or Email</label>
              <div className="relative group">
                <div
                  className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none"
                  style={{ color: errors.identifier ? '#ef4444' : 'rgba(255,255,255,0.3)' }}
                >
                  <User className="w-[18px] h-[18px]" />
                </div>
                <input
                  id="identifier"
                  {...register('identifier')}
                  type="text"
                  placeholder="Username or email address"
                  autoComplete="username"
                  aria-invalid={errors.identifier ? 'true' : 'false'}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                  className="w-full h-[52px] pl-[44px] pr-4 rounded-xl text-sm text-white placeholder-transparent outline-none transition-all duration-200 peer"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: errors.identifier ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                    caretColor: '#4FD1FF',
                  }}
                  onFocus={(e) => {
                    if (!errors.identifier) e.target.style.borderColor = 'rgba(79,209,255,0.4)';
                  }}
                  onBlur={(e) => {
                    if (!errors.identifier) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
              </div>
              {errors.identifier && (
                <p id="identifier-error" role="alert" className="text-[11px] mt-1.5 ml-1 flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="5" stroke="#ef4444" strokeWidth="1" />
                    <path d="M6 4V6.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="6" cy="8.5" r="0.6" fill="#ef4444" />
                  </svg>
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div
              className={`transition-all duration-700 delay-[500ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative group">
                <div
                  className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none"
                  style={{ color: errors.password ? '#ef4444' : 'rgba(255,255,255,0.3)' }}
                >
                  <Lock className="w-[18px] h-[18px]" />
                </div>
                <input
                  id="password"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="w-full h-[52px] pl-[44px] pr-[44px] rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: errors.password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                    caretColor: '#4FD1FF',
                  }}
                  onFocus={(e) => {
                    if (!errors.password) e.target.style.borderColor = 'rgba(79,209,255,0.4)';
                  }}
                  onBlur={(e) => {
                    if (!errors.password) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[14px] top-1/2 -translate-y-1/2 w-[32px] h-[32px] flex items-center justify-center rounded-lg transition-colors duration-200"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-[11px] mt-1.5 ml-1 flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="5" stroke="#ef4444" strokeWidth="1" />
                    <path d="M6 4V6.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="6" cy="8.5" r="0.6" fill="#ef4444" />
                  </svg>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me + Forgot */}
            <div
              className={`flex items-center justify-between transition-all duration-700 delay-[600ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <label className="flex items-center gap-2.5 cursor-pointer group" style={{ minHeight: 44 }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(!rememberMe)}
                  className="w-[20px] h-[20px] rounded-[5px] flex items-center justify-center transition-all duration-200 flex-shrink-0"
                  style={{
                    background: rememberMe ? '#4FD1FF' : 'rgba(255,255,255,0.06)',
                    border: rememberMe ? '1px solid #4FD1FF' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {rememberMe && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                      <path d="M1.5 5l2.5 2.5L9.5 1" stroke="#06142B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-xs select-none transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Remember me
                </span>
              </label>

              <Link
                to="/forgot-password"
                className="text-xs font-medium transition-all duration-200 hover:brightness-125 flex-shrink-0"
                style={{ color: '#4FD1FF' }}
                tabIndex={0}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit button */}
            <div
              className={`transition-all duration-700 delay-[700ms] ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <button
                type="submit"
                disabled={isSubmitting}
                className="relative w-full h-[52px] rounded-xl font-bold text-sm tracking-wide overflow-hidden transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{
                  background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
                  color: '#07121F',
                  boxShadow: '0 4px 20px rgba(69,214,255,0.25)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(69,214,255,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(69,214,255,0.25)';
                }}
              >
                {/* Shimmer overlay */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 2s infinite',
                  }}
                  aria-hidden="true"
                />
                <span className="relative z-10 flex items-center justify-center gap-2.5">
                  {isSubmitting ? (
                    <span className="w-[18px] h-[18px] border-2 border-[#07121F] border-t-transparent rounded-full animate-spin" role="status" aria-label="Signing in" />
                  ) : (
                    <>
                      <Fingerprint className="w-[16px] h-[16px]" />
                      Sign In
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>

          {/* Footer */}
          <div
            className={`text-center mt-7 transition-all duration-700 delay-[800ms] ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Need access?{' '}
              <button
                type="button"
                className="font-medium transition-all duration-200 hover:brightness-125 cursor-pointer"
                style={{ color: '#4FD1FF' }}
                tabIndex={0}
              >
                Contact Administrator
              </button>
            </p>
            <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.15)' }}>
              TrackImplant v2.0 &middot; Clinical ERP
            </p>
          </div>
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
