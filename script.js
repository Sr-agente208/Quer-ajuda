const form = document.querySelector('#login-form');
const password = document.querySelector('#password');
const toggle = document.querySelector('#password-toggle');
const message = document.querySelector('#form-message');
const dialog = document.querySelector('#info-dialog');
const title = document.querySelector('#dialog-title');
const copy = document.querySelector('#dialog-copy');

toggle.addEventListener('click', () => {
  const hidden = password.type === 'password';
  password.type = hidden ? 'text' : 'password';
  toggle.textContent = hidden ? '◉' : '◉';
  toggle.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
});

form.addEventListener('submit', event => {
  event.preventDefault();
  message.textContent = '';
  if (!form.checkValidity()) {
    message.textContent = 'Preencha seu e-mail e senha para continuar.';
    form.reportValidity();
    return;
  }
  message.style.color = '#278477';
  message.textContent = 'Tudo certo! Estamos preparando seu acesso.';
});

document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
  const signup = button.dataset.action === 'signup';
  title.textContent = signup ? 'Vamos criar sua conta!' : 'Recuperar senha';
  copy.textContent = signup ? 'O cadastro estará disponível em breve. Obrigado por querer fazer parte dessa rede de apoio.' : 'Em breve você poderá recuperar o acesso usando o e-mail cadastrado.';
  dialog.showModal();
}));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-button').addEventListener('click', () => dialog.close());
