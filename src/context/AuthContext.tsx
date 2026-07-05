/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from '../services/auditLogService';
import { userService } from '../services/userService';
import type { AuthUser, UserRole } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isAuthenticated: false,
  signIn: async () => ({}),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchProfile = useCallback(async (authUserId: string, _email: string) => {
    try {
      const profile = await userService.getByAuthId(authUserId);
      if (profile) {
        setUser({
          id: authUserId,
          role: profile.role,
          full_name: profile.full_name,
          username: profile.username,
          is_active: profile.is_active,
          branch_id: profile.branch_id,
        });
      } else {
        setUser({
          id: authUserId,
          role: 'Admin' as UserRole,
          full_name: '',
          username: '',
          is_active: true,
        });
      }
    } catch {
      const metaRole = (await supabase.auth.getSession()).data.session?.user?.user_metadata?.role as string | undefined;
      const validRoles: UserRole[] = ['Manager', 'Admin', 'Doctor', 'Assistant', 'Receptionist'];
      setUser({
        id: authUserId,
        role: validRoles.includes(metaRole as UserRole) ? (metaRole as UserRole) : 'Admin',
        full_name: '',
        username: '',
        is_active: true,
      });
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email || '');
        }
      } finally {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (session?.user) {
            await fetchProfile(session.user.id, session.user.email || '');
          } else {
            setUser(null);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (identifier: string, password: string): Promise<{ error?: string }> => {
    try {
      let email: string;
      let username: string | undefined;

      if (identifier.includes('@')) {
        email = identifier;
      } else {
        const { data: userRecord, error: lookupError } = await supabase
          .rpc('get_user_email_by_username', { lookup_username: identifier })
          .maybeSingle();
        if (lookupError || !userRecord) return { error: 'Invalid username or password' };
        const rec = userRecord as { is_active?: boolean; email?: string; username?: string };
        if (!rec.is_active) return { error: 'Your account has been disabled. Contact administrator.' };
        email = rec.email || identifier;
        username = rec.username;
      }

      // Try the real email first. For legacy accounts created with a .local
      // domain, fall back to {username}@trackimplant.local.
      const emailsToTry = [email];
      if (username && !email.endsWith('@trackimplant.local')) {
        emailsToTry.push(`${username}@trackimplant.local`);
      }

      let data: { user: import('@supabase/supabase-js').User; session: import('@supabase/supabase-js').Session } | null = null;

      for (const tryEmail of emailsToTry) {
        const result = await supabase.auth.signInWithPassword({ email: tryEmail, password });
        if (!result.error) {
          data = result.data;
          break;
        }
        if (result.error.message !== 'Invalid login credentials') {
          return { error: result.error.message };
        }
      }

      if (!data) return { error: 'Invalid username or password' };

      if (data.user) {
        await fetchProfile(data.user.id, data.user.email || '');
      }

      // Log the login event (fire-and-forget — must not block login)
      getCurrentUserInfo().then(actor => {
        if (actor) {
          auditLogService.log({
            user_id: actor.user_id,
            user_name: actor.user_name,
            action: 'LOGIN',
            table_name: 'users',
            record_id: actor.user_id,
          });
        }
      }).catch(() => {});

      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
