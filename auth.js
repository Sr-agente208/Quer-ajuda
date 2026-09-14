// Funções de autenticação compartilhadas
import { supabase, getCurrentUser, getMyProfile } from './supabase.js';

// Cadastro
export async function signUp({ email, password, fullName, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role
      }
    }
  });
  return { data, error };
}

// Login
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// Logout
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// Recuperação de senha
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/home.html'
  });
  return { data, error };
}

// Guard: redireciona pro login se não tiver user logado
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

// Pega o user + profile, ou redireciona pro login
export async function requireAuthAndProfile() {
  const user = await requireAuth();
  if (!user) return null;
  const profile = await getMyProfile();
  if (!profile) {
    // Profile não existe ainda, esperar trigger ou criar manualmente
    return { user, profile: null };
  }
  return { user, profile };
}
