import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, User } from 'lucide-react';

const authSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AuthForm = z.infer<typeof authSchema>;

function MedicalCrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="6" width="8" height="28" rx="2" fill="currentColor" />
      <rect x="6" y="16" width="28" height="8" rx="2" fill="currentColor" />
    </svg>
  );
}

export const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthForm>({
    resolver: zodResolver(authSchema)
  });

  const onSubmit = async (data: AuthForm) => {
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
      <div className="absolute inset-0 bg-gradient-to-br from-[#06142B] to-[#0B1F3A] z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4FD1FF] opacity-[0.04] rounded-full blur-[120px] z-0" />
      <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-72 h-48 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute top-[30%] right-[8%] w-96 h-56 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute bottom-[20%] left-[15%] w-80 h-40 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute bottom-[10%] right-[20%] w-64 h-36 rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 blur-sm" />
        <div className="absolute top-[50%] left-[40%] w-3 h-3 rounded-full bg-[#4FD1FF]/30 blur-[2px]" />
        <div className="absolute top-[20%] left-[60%] w-2 h-2 rounded-full bg-[#4FD1FF]/20 blur-[1px]" />
        <div className="absolute bottom-[40%] right-[30%] w-2.5 h-2.5 rounded-full bg-[#4FD1FF]/25 blur-[1px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/30 via-transparent to-[#4FD1FF]/10 blur-[2px]" />
        <div className="absolute -inset-[2px] rounded-[28px] bg-gradient-to-br from-[#4FD1FF]/15 via-transparent to-[#4FD1FF]/5" />

        <div
          className="relative w-full rounded-[24px] p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
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
            <h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: "'Inter','SF Pro Display','Poppins',sans-serif", color: '#4FD1FF' }}>
              TrackImplant
            </h1>
            <p className="text-xs tracking-[0.25em] uppercase mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
              PRECISION DENTAL TECH
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#4FD1FF] transition-colors duration-300">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  {...register('identifier')}
                  type="text"
                  placeholder="Username or Email"
                  className="w-full h-[50px] pl-11 pr-4 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-[0_0_20px_rgba(79,209,255,0.08)]"
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
              {errors.identifier && <p className="text-xs text-red-400 mt-1.5 ml-1">{errors.identifier.message}</p>}
            </div>

            <div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#4FD1FF] transition-colors duration-300">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full h-[50px] pl-11 pr-11 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-[0_0_20px_rgba(79,209,255,0.08)]"
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1.5 ml-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className="w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer"
                  style={{
                    background: rememberMe ? '#4FD1FF' : 'rgba(255,255,255,0.06)',
                    border: rememberMe ? '1px solid #4FD1FF' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#06142B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Remember me</span>
              </label>

              <Link
                to="/forgot-password"
                className="text-xs font-medium transition-all duration-200 hover:brightness-125"
                style={{ color: '#4FD1FF' }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
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
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-[#07121F] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Sign In &rarr;</>
                )}
              </span>
            </button>
          </form>

          <div className="text-center mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Need access?{' '}
            <span className="font-medium cursor-pointer transition-colors duration-200 hover:brightness-125" style={{ color: '#4FD1FF' }}>
              Contact Administrator
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
