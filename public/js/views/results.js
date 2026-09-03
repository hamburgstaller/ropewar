/**
 * Results screen.
 */

import { router } from '../router.js';
import { socketService } from '../socket.js';
import { escapeHtml } from '../router.js';

let resultData = null;

export async function renderResults(params, query, state) {
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.remove('hidden');

  const myUserId = socketService.getUser().userId;
  // First try state, then sessionStorage, then API
  resultData = state?.result || null;
  if (!resultData && params.matchId) {
    try {
      const stored = sessionStorage.getItem(`matchResult:${params.matchId}`);
      if (stored) resultData = JSON.parse(stored);
    } catch (e) { /* ignore */ }
  }
  if (!resultData && params.matchId) {
    // Last resort: fetch the match from the API
    try {
      const res = await fetch(`/api/match/${params.matchId}`, { credentials: 'same-origin' });
      if (res.ok) {
        const m = await res.json();
        // Convert DB format to server tick-end format
        const myEntry = m.players.find(p => p.userId === myUserId);
        const won = myEntry ? m.winner_team === myEntry.team : false;
        resultData = {
          matchId: m.id,
          mode: m.mode,
          winnerTeam: m.winner_team,
          durationSec: m.duration_sec,
          finalRopePos: 0,  // Not persisted in the DB
          teamA: m.players.filter(p => p.team === 'A'),
          teamB: m.players.filter(p => p.team === 'B'),
          results: Object.entries(m.mmrDeltas || {}).map(([userId, delta]) => ({
            userId: Number(userId),
            mmrDelta: delta,
            won: won,
            mmrBefore: 0,
            mmrAfter: 0,
            rankBefore: '',
            rankAfter: ''
          }))
        };
      }
    } catch (e) { /* ignore */ }
  }

  if (!resultData) {
    app.innerHTML = `
      <div class="center-page">
        <div class="card">
          <h2>Result could not be loaded</h2>
          <p>This page was opened directly. Please play a match first.</p>
          <a href="#/menu">Main menu</a>
        </div>
      </div>
    `;
    return;
  }

  const myResult = resultData.results?.find(r => r.userId === myUserId);
  const won = myResult?.won;
  const draw = !resultData.winnerTeam;
  const winnerClass = draw ? 'draw' : (won ? 'won' : 'lost');
  const winnerText = draw ? '🤝 Draw'
                   : won ? '🎉 You won!'
                   : '😔 You lost';

  const teamAWon = resultData.winnerTeam === 'A';
  const myDelta = myResult?.mmrDelta || 0;
  const myBefore = myResult?.mmrBefore || 0;
  const myAfter = myResult?.mmrAfter || 0;

  app.innerHTML = `
    <div class="container">
      <div class="card results-card">
        <div class="winner-banner ${winnerClass}">${winnerText}</div>
        <p style="color: var(--text-dim);">${escapeHtml(resultData.mode || '')} - ${Math.round(resultData.durationSec)} seconds</p>

        ${myResult ? `
          <div class="results-stats">
            <div class="stat-box">
              <div class="label">Previous MMR</div>
              <div class="value">${myBefore}</div>
            </div>
            <div class="stat-box">
              <div class="label">New MMR</div>
              <div class="value">${myAfter}</div>
            </div>
            <div class="stat-box">
              <div class="label">Change</div>
              <div class="value ${myDelta > 0 ? 'positive' : myDelta < 0 ? 'negative' : ''}">
                ${myDelta > 0 ? '+' : ''}${myDelta}
              </div>
            </div>
          </div>
        ` : ''}

        <div class="results-teams">
          <div class="results-team team-A">
            <h4>${teamAWon ? '🏆 ' : ''}Team A ${resultData.winnerTeam === 'A' ? '(Winner)' : ''}</h4>
            ${(resultData.teamA || []).map(p => {
              const delta = resultData.results?.find(r => r.userId === p.userId)?.mmrDelta;
              return `<div class="player">
                <span>${escapeHtml(p.username)}${p.isBot ? ' 🤖' : ''}</span>
                <span class="delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">
                  ${delta != null ? (delta > 0 ? '+' : '') + delta : ''}
                </span>
              </div>`;
            }).join('')}
          </div>
          <div class="results-team team-B">
            <h4>${!teamAWon && resultData.winnerTeam === 'B' ? '🏆 ' : ''}Team B ${resultData.winnerTeam === 'B' ? '(Winner)' : ''}</h4>
            ${(resultData.teamB || []).map(p => {
              const delta = resultData.results?.find(r => r.userId === p.userId)?.mmrDelta;
              return `<div class="player">
                <span>${escapeHtml(p.username)}${p.isBot ? ' 🤖' : ''}</span>
                <span class="delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">
                  ${delta != null ? (delta > 0 ? '+' : '') + delta : ''}
                </span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="results-actions">
          <button id="play-again">Play Again</button>
          <a href="#/menu" class="btn btn-secondary">Main Menu</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('play-again').addEventListener('click', () => {
    router.navigate('/play');
  });
}
