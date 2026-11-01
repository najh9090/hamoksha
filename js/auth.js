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
  return data; // data.session is null when email confirmation is enabled
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
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}
