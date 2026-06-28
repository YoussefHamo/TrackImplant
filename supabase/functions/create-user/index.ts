import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2';

interface CreateUserPayload {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const log = (msg: string, data?: unknown) => {
    console.log(`[create-user] ${msg}`, data ?? '');
  };

  try {
    // 1. Extract and validate auth token
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // 2. Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      log('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Verify the caller is authenticated
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(authHeader);
    if (callerError || !caller) {
      log('Invalid or expired auth token', callerError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or expired session' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // 4. Verify caller is an Admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    if (profileError) {
      log('Failed to fetch caller profile', profileError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!callerProfile || callerProfile.role !== 'Admin') {
      log(`Non-admin user ${caller.id} attempted to create user`);
      return new Response(
        JSON.stringify({ error: 'User not allowed' }),
        { status: 403, headers: corsHeaders },
      );
    }

    // 5. Validate request body
    let body: CreateUserPayload;
    try {
      body = await req.json();
    } catch {
      log('Invalid JSON in request body');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { full_name, username, email, password, role } = body;

    const missingFields: string[] = [];
    if (!full_name?.trim()) missingFields.push('full_name');
    if (!username?.trim()) missingFields.push('username');
    if (!email?.trim()) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!role) missingFields.push('role');

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Required fields missing: ${missingFields.join(', ')}` }),
        { status: 400, headers: corsHeaders },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: corsHeaders },
      );
    }

    if (!['Doctor', 'Receptionist'].includes(role)) {
      log(`Invalid role attempt: ${role}`);
      return new Response(
        JSON.stringify({ error: 'User not allowed' }),
        { status: 403, headers: corsHeaders },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: corsHeaders },
      );
    }

    // 6. Check uniqueness constraints
    const { data: existingUsername } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ error: 'Username already taken' }),
        { status: 409, headers: corsHeaders },
      );
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 409, headers: corsHeaders },
      );
    }

    // 7. Create Supabase Auth user (server-side with service_role key)
    log(`Creating auth user for ${email.trim().toLowerCase()}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        username: username.trim(),
        role,
      },
    });

    if (authError) {
      log('Auth user creation failed', authError.message);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: corsHeaders },
      );
    }

    if (!authData.user) {
      log('Auth user creation returned null');
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user — no user returned' }),
        { status: 500, headers: corsHeaders },
      );
    }

    // 8. Insert into public.users table
    log(`Inserting public user record for ${authData.user.id}`);
    const { data: userRecord, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: authData.user.id,
        username: username.trim(),
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        role,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      log('User record insert failed, rolling back auth user', insertError.message);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(e =>
        log('Rollback delete failed', e.message)
      );
      return new Response(
        JSON.stringify({ error: 'Failed to create user record: ' + insertError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    log(`User created successfully: ${userRecord.id}`);
    return new Response(JSON.stringify({ user: userRecord }), { status: 200, headers: corsHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    log('Unhandled exception', msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
