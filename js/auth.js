import { sb } from './supabaseClient.js';

export async function signUp({ email, password, name, role, teacherCode }) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        role,
        teacher_code: role === 'teacher' ? teacherCode || '' : '',
      },
    },
  });
  if (error) throw error;
  if (data.session) return data;
  // No session returned (Supabase still has "Confirm email" on, or the email
  // already exists). Email confirmation is not used, so log straight in.
  return signIn({ email, password });
}

export async function signIn({ email, password }) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export const signOut = () => sb.auth.signOut();

export async function getSessionUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

export async function getProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  // Accounts created before the schema was installed have no profile row.
  const { data: created, error: rpcError } = await sb.rpc('ensure_profile');
  if (rpcError) throw rpcError;
  return created;
}
