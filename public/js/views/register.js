/**
 * Register view.
 */

import { api } from '../api.js';
import { router } from '../router.js';

export async function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="center-page">
      <div class="auth-card">
        <h1>🪢 Rope War</h1>
        <p class="subtitle">Create a new account</p>
        <div class="auth-error" id="reg-error"></div>
        <form id="reg-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]+" />
          </div>
          <div class="form-group">
            <label>Password (at least 6 characters)</label>
            <input type="password" name="password" required minlength="6" autocomplete="new-password" />
          </div>
          <button type="submit">Register</button>
        </form>
        <p class="auth-footer">
          Already have an account? <a href="#/login">Sign in</a>
        </p>
      </div>
    </div>
  `;

  const form = document.getElementById('reg-form');
  const errorEl = document.getElementById('reg-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    const data = new FormData(form);
    try {
      const result = await api.register(
        data.get('email'),
        data.get('username'),
        data.get('password')
      );
      window.dispatchEvent(new CustomEvent('auth:login', { detail: result.user }));
      router.navigate('/menu');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('show');
    }
  });

  document.getElementById('navbar').classList.add('hidden');
}
