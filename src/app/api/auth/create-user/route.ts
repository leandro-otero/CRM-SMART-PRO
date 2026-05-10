import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase client with the service role key to bypass RLS and Auth rules
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: Request) {
  try {
    const { email, password, nome, role } = await request.json();

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 });
    }

    if (!email || !password || !nome) {
      return NextResponse.json({ error: 'E-mail, palavra-passe e nome são obrigatórios' }, { status: 400 });
    }

    // This uses the Admin Auth API to create a user without signing them in
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        nome,
        role: role || 'membro'
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      user: data.user 
    });

  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ error: 'Erro interno ao criar utilizador' }, { status: 500 });
  }
}
