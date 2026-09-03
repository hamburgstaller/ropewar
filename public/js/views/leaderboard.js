/**
 * Leaderboard page.
 */

import { api } from '../api.js';
import { escapeHtml } from '../router.js';

let currentMode = 'overall';

export async function renderLeaderboard() {
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.remove('hidden');

  app.innerHTML = `
    <div class="container">
      <h1 class="page-title">🏆 Leaderboard</h1>
      <div class="tabs">
        <button class="tab active" data-mode="overall">Overall</button>
        <button class="tab" data-mode="1v1">1v1</button>
        <button class="tab" data-mode="3v3">3v3</button>
        <button class="tab" data-mode="5v5">5v5</button>
      </div>
      <div id="leaderboard-content">Loading...</div>
    </div>
  `;

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentMode = tab.dataset.mode;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      loadAndRender();
    });
  });

  await loadAndRender();
}

async function loadAndRender() {
  const content = document.getElementById('leaderboard-content');
  content.innerHTML = 'Loading...';
  try {
    const result = await api.leaderboard(currentMode, 100);
    if (result.entries.length === 0) {
      content.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px; color: var(--text-dim);">
          No leaderboard data yet. As matches are played this will fill up!
        </div>
      `;
      return;
    }
    content.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Player</th>
            <th>Rank</th>
            <th style="text-align: right;">MMR</th>
            <th style="text-align: right;">W/L</th>
            <th style="text-align: right;">Win %</th>
          </tr>
        </thead>
        <tbody>
          ${result.entries.map(e => `
            <tr>
              <td class="rank ${e.rank === 1 ? 'gold' : e.rank === 2 ? 'silver' : e.rank === 3 ? 'bronze' : ''}">
                ${e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank}
              </td>
              <td class="username">${escapeHtml(e.username)}</td>
              <td class="tier-${e.tier}">${e.tier}</td>
              <td class="mmr">${e.mmr}</td>
              <td style="text-align: right; color: var(--text-dim);">${e.wins} / ${e.losses}</td>
              <td style="text-align: right; color: var(--text-dim);">${e.winRate}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    content.innerHTML = `<div class="card">Error: ${escapeHtml(err.message)}</div>`;
  }
}
