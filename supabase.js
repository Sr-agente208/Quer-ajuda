// Cliente Supabase compartilhado entre as páginas
// Usa CDN jsDelivr (não precisa de bundler)
const SUPABASE_URL = 'https://ymttnsejqmizghaqoewv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_79Ogt01EvlMLbH6ZPalk-g_Usi6ZlDR';

if (window.supabase && window.supabase.createClient) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
      storageKey: 'querajuda.auth',
      storageAutoRefreshInterval: 60,
      detectSessionInUrl: false
    }
  });
  // API simplificada que delega pro window.sb
  window.sbAPI = {
    supabase: window.sb,
    getCurrentUser: async () => {
      const { data: { user } } = await window.sb.auth.getUser();
      return user;
    },
    getMyProfile: async () => {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return null;
      const { data, error } = await window.sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    updateMyPreferences: async (prefs) => {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return { error: 'not logged in' };
      return await window.sb.from('profiles').update(prefs).eq('id', user.id);
    },
    getMyLinkedIdosoIds: async () => {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return [];
      const { data } = await window.sb
        .from('care_links')
        .select('idoso_id')
        .eq('responsavel_id', user.id);
      return (data || []).map(r => r.idoso_id);
    },
    signUp: ({ email, password, fullName, role }) =>
      window.sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: role } }
      }),
    signIn: ({ email, password }) =>
      window.sb.auth.signInWithPassword({ email, password }),
    signOut: () => window.sb.auth.signOut(),
    resetPassword: (email) =>
      window.sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/home.html' })
  };
}
