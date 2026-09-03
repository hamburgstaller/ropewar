/**
 * Profile page.
 */

import { api } from '../api.js';
import { escapeHtml } from '../router.js';

export async function renderProfile() {
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.remove('hidden');

  app.innerHTML = `
    <div class="container">
      <div class="card" style="text-align: center; padding: 48px;">
        Loading...
      </div>
    </div>
  `;

  try {
    const [profileRes, historyRes] = await Promise.all([
      api.profile(),
      api.matchHistory(20)
    ]);
    const u = profileRes.user;
    const matches = historyRes.matches;

    app.innerHTML = `
      <div class="container">
        <div class="profile-header">
          <div class="profile-avatar">${escapeHtml(u.username.charAt(0).toUpperCase())}</div>
          <div class="profile-info">
            <h2>${escapeHtml(u.username)}</h2>
            <span class="profile-tier-badge tier-${u.rank_tier}" style="color: ${u.tierColor};">
              ${u.rank_tier}
            </span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.9rem; color: var(--text-dim);">MMR</div>
            <div style="font-size: 2rem; font-weight: 800;">${u.mmr}</div>
          </div>
        </div>

        <div class="profile-stats-row">
          <div class="profile-stat">
            <div class="value">${u.games_played}</div>
            <div class="label">Total Matches</div>
          </div>
          <div class="profile-stat">
            <div class="value">${u.wins}</div>
            <div class="label">Wins</div>
          </div>
          <div class="profile-stat">
            <div class="value">${u.losses}</div>
            <div class="label">Losses</div>
          </div>
          <div class="profile-stat">
            <div class="value">${u.winRate}%</div>
            <div class="label">Win Rate</div>
          </div>
        </div>

        <div class="match-history">
          <h3>Recent Matches</h3>
          ${matches.length === 0 ? `
            <div class="card" style="text-align: center; padding: 32px; color: var(--text-dim);">
              No matches yet. <a href="#/play">Let's get started!</a>
            </div>
          ` : matches.map(m => `
            <div class="match-row">
              <span class="result ${m.won ? 'win' : 'loss'}">${m.won ? 'WIN' : 'LOSS'}</span>
              <span class="mode">${escapeHtml(m.mode)}</span>
              <span class="when">${formatRelativeTime(m.createdAt)}</span>
              <span class="duration" style="color: var(--text-dim);">${Math.round(m.durationSec)}s</span>
              <span class="delta ${m.myMmrDelta > 0 ? 'positive' : 'negative'}">
                ${m.myMmrDelta > 0 ? '+' : ''}${m.myMmrDelta}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `
      <div class="container">
        <div class="card" style="text-align: center; padding: 48px;">
          <h2>Error</h2>
          <p>${escapeHtml(err.message)}</p>
          <a href="#/menu">Main menu</a>
        </div>
      </div>
    `;
  }
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}
