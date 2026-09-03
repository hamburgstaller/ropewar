/**
 * Main menu.
 */

import { router } from '../router.js';

export async function renderMenu() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container">
      <h1 class="page-title">🪢 Rope War</h1>
      <div class="menu-actions">
        <a href="#/play" class="menu-action">
          <div class="icon">🎮</div>
          <div class="label">Play</div>
          <div class="desc">1v1, 3v3, 5v5 modes</div>
        </a>
        <a href="#/leaderboard" class="menu-action">
          <div class="icon">🏆</div>
          <div class="label">Leaderboard</div>
          <div class="desc">Top players</div>
        </a>
        <a href="#/profile" class="menu-action">
          <div class="icon">👤</div>
          <div class="label">Profile</div>
          <div class="desc">Your stats</div>
        </a>
        <a href="https://github.com" target="_blank" class="menu-action" style="opacity: 0.6;">
          <div class="icon">ℹ️</div>
          <div class="label">About</div>
          <div class="desc">v1.0 - Rope War</div>
        </a>
      </div>
    </div>
  `;
  document.getElementById('navbar').classList.remove('hidden');
}
