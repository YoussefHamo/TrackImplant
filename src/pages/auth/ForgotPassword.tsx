import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';

function MedicalCrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="6" width="8" height="28" rx="2" fill="currentColor" />
      <rect x="6" y="16" width="28" height="8" rx="2" fill="currentColor" />
    </svg>
  );
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
          {sent ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00E5A8]/10 border border-[#00E5A8]/20 mb-5">
                <svg className="w-7 h-7 text-[#00E5A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[24px] font-semibold tracking-tight text-white mb-2">
                Check Your Email
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                We sent a recovery link to <strong className="text-white">{email}</strong>. It may take a few minutes to arrive.
              </p>
              <Link to="/"
                className="inline-flex items-center gap-2 mt-6 text-sm font-medium transition-all duration-200 hover:brightness-125"
                style={{ color: '#4FD1FF' }}>
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 mb-5">
                  <MedicalCrossIcon className="w-7 h-7 text-[#4FD1FF]" />
                </div>
                <h1 className="text-[28px] font-semibold tracking-tight text-white">
                  Reset Password
                </h1>
                <p className="text-xs tracking-[0.25em] uppercase mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Enter your email to recover
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 rounded-xl text-sm bg-red-950/30 border border-red-500/30 text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#4FD1FF] transition-colors duration-300">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email address"
                      className="w-full h-[50px] pl-11 pr-4 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-[0_0_20px_rgba(79,209,255,0.08)]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        caretColor: '#4FD1FF',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(79,209,255,0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
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
                      <>Send Recovery Link &rarr;</>
                    )}
                  </span>
                </button>
              </form>

              <div className="text-center mt-6">
                <Link to="/" className="text-xs font-medium transition-all duration-200 hover:brightness-125" style={{ color: '#4FD1FF' }}>
                  <span className="flex items-center justify-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
