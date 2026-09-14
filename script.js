// ============================================
// Quer Ajuda? — script principal (v16 - fluxo único)
// ============================================

console.log('=== script.js v16 INICIOU ===');

// === SUPABASE ===
const SUPABASE_URL = 'https://ymttnsejqmizghaqoewv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_79Ogt01EvlMLbH6ZPalk-g_Usi6ZlDR';

let sb = null;
let sbReady = false;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
        storageKey: 'querajuda.auth',
        storageAutoRefreshInterval: 60,
        detectSessionInUrl: false
      }
    });
    sbReady = true;
    console.log('✅ Supabase OK');
  }
} catch (e) { console.error('❌ Supabase:', e); }

// === TEMA ===
const themeOrder = ['light', 'dark', 'auto'];
function getTheme() { try { return localStorage.getItem('querajuda.theme') || 'light'; } catch (e) { return 'light'; } }
function setTheme(theme) {
  try { localStorage.setItem('querajuda.theme', theme); } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
  if (sbReady) {
    sb.auth.getUser().then(r => {
      if (r.data.user) return sb.from('profiles').update({ theme }).eq('id', r.data.user.id);
    }).catch(() => {});
  }
}
function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
  setTheme(next);
}
setTheme(getTheme());

if (sbReady) {
  sb.auth.getUser().then(r => {
    if (!r.data.user) return null;
    return sb.from('profiles').select('theme,font_scale').eq('id', r.data.user.id).single();
  }).then(p => {
    if (p && p.data) {
      if (p.data.theme) setTheme(p.data.theme);
      if (p.data.font_scale) document.documentElement.style.setProperty('--font-scale', String(p.data.font_scale));
    }
  }).catch(() => {});
}

// === ELEMENTOS ===
const form = document.getElementById('login-form');
const msgEl = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');

function setMsg(text, color) {
  if (msgEl) { msgEl.textContent = text; msgEl.style.color = color || '#ce4d2d'; }
}

// Theme toggle
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
  themeBtn.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    cycleTheme();
  };
}

// Password toggle
const passwordInput = document.getElementById('password');
const passwordToggleBtn = document.getElementById('password-toggle');
if (passwordToggleBtn && passwordInput) {
  passwordToggleBtn.onclick = function() {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    passwordToggleBtn.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
  };
}

// === SUBMIT ÚNICO: tenta login, se falhar tenta signup ===
if (form) {
  form.onsubmit = async function(e) {
    e.preventDefault();
    setMsg('Verificando...', '#278477');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; submitBtn.innerHTML = 'Aguarde...'; }

    try {
      const fullName = (form.querySelector('#full-name') || {}).value.trim() || '';
      const email = (form.querySelector('#email') || {}).value.trim();
      const password = (form.querySelector('#password') || {}).value;
      const selectedRole = form.querySelector('input[name="role"]:checked');
      const role = selectedRole ? selectedRole.value : null;

      // Validações
      if (!role) { setMsg('Escolha se você é idoso ou responsável.'); restore(); return; }
      if (!fullName) { setMsg('Informe seu nome.'); restore(); return; }
      if (!email) { setMsg('Informe seu e-mail.'); restore(); return; }
      if (!password) { setMsg('Informe sua senha.'); restore(); return; }
      if (password.length < 6) { setMsg('A senha precisa ter pelo menos 6 caracteres.'); restore(); return; }
      if (!sbReady) { setMsg('Supabase não carregou. Recarregue a página.'); restore(); return; }

      console.log('Tentando login com:', email);

      // 1) Tenta fazer login
      let result = await sb.auth.signInWithPassword({ email, password });

      // 2) Se falhou com "credenciais inválidas", tenta criar conta
      if (result.error && result.error.message && result.error.message.toLowerCase().includes('invalid')) {
        console.log('Login falhou, tentando criar conta...');
        setMsg('Conta não existe. Criando agora...', '#278477');
        result = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role: role } }
        });
        if (result.error) {
          setMsg('Erro: ' + result.error.message);
          restore();
          return;
        }
        setMsg('Conta criada! Entrando...', '#278477');
      } else if (result.error) {
        setMsg('Erro: ' + result.error.message);
        restore();
        return;
      } else {
        setMsg('Bem-vindo de volta! Entrando...', '#278477');
      }

      // Sucesso — redireciona
      setTimeout(() => { window.location.href = 'home.html'; }, 600);

    } catch (err) {
      console.error('Erro submit:', err);
      setMsg('Erro: ' + (err.message || err));
      restore();
    }

    function restore() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.innerHTML = 'Entrar <span>→</span>';
      }
    }
  };
}

console.log('=== script.js v16 FINALIZOU ===');
