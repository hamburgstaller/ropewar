/**
 * Login view.
 */

import { api } from '../api.js';
import { router, escapeHtml } from '../router.js';

export async function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="center-page">
      <div class="auth-card">
        <h1>🪢 Rope War</h1>
        <p class="subtitle">Sign in to your account</p>
        <div class="auth-error" id="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <button type="submit">Sign In</button>
        </form>
        <p class="auth-footer">
          Don't have an account? <a href="#/register">Register</a>
        </p>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    const data = new FormData(form);
    try {
      const result = await api.login(data.get('email'), data.get('password'));
      // Fire auth event
      window.dispatchEvent(new CustomEvent('auth:login', { detail: result.user }));
      router.navigate('/menu');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('show');
    }
  });

  // Hide the navbar
  document.getElementById('navbar').classList.add('hidden');
}
