import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner'; // استبدل الـ alert التقليدي بـ toast احترافي لو متاح عندك

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. تسجيل المستخدم في نظام الـ Auth الرئيسي مع تمرير الـ Metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // role and full_name stored in user_metadata for AuthContext to read
          data: {
            role: role,
            full_name: email.split('@')[0]
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        toast.success('Identity Created Successfully! You can login now.');
        navigate('/'); // يرجع لصفحة الـ Login الرئيسية
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-md bg-[#16191e] border border-[#222630] rounded-xl p-8 shadow-2xl shadow-cyan-950/20">
        <h2 className="text-2xl font-bold text-center text-white mb-8 tracking-wider uppercase">
          Create Identity Node
        </h2>

        {error && (
          <div className="bg-red-950/30 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">System Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d0f12] border border-[#2d3341] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="name@skydent.com"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Access Cipher (Password)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0d0f12] border border-[#2d3341] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="•••••••• (min. 6 characters)"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#0d0f12] border border-[#2d3341] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
            >
              <option value="Doctor">Doctor / Consultant</option>
              <option value="Assistant">Assistant / Staff</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#0d0f12] font-bold py-3 rounded-lg uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Initializing...' : 'Initialize Node'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-cyan-500/80 hover:text-cyan-400 transition-colors">
            Already have an identity? Connect here
          </Link>
        </div>
      </div>
    </div>
  );
}