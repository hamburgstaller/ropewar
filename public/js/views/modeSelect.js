/**
 * Mode selection screen.
 * Two options: Online Matchmaking (queue) or Play vs Bot Now.
 */

import { router } from '../router.js';
import { api } from '../api.js';
import { socketService } from '../socket.js';
import { showToast } from '../shared/toast.js';

export async function renderModeSelect() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="container">
      <h1 class="page-title">Choose Mode</h1>
      <div class="modes-grid">
        <div class="mode-card" data-mode="1v1">
          <div class="mode-icon">⚔️</div>
          <div class="mode-title">1v1</div>
          <div class="mode-desc">One-on-one duel</div>
          <div class="mode-players">2 players</div>
        </div>
        <div class="mode-card" data-mode="3v3">
          <div class="mode-icon">👥</div>
          <div class="mode-title">3v3</div>
          <div class="mode-desc">Small team battle</div>
          <div class="mode-players">6 players</div>
        </div>
        <div class="mode-card" data-mode="5v5">
          <div class="mode-icon">🛡️</div>
          <div class="mode-title">5v5</div>
          <div class="mode-desc">Large team battle</div>
          <div class="mode-players">10 players</div>
        </div>
      </div>

      <div id="mode-action" class="card" style="margin-top: 32px; text-align: center; padding: 24px; display: none;">
        <h3 id="mode-action-title">1v1</h3>
        <p style="color: var(--text-dim); margin: 8px 0 20px;">How do you want to play?</p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button id="btn-online" class="btn-large">🌐 Online Matchmaking</button>
          <button id="btn-bot" class="btn-large btn-secondary">🤖 Play vs Bot Now</button>
          <button id="btn-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('navbar').classList.remove('hidden');

  let selectedMode = null;
  const actionEl = document.getElementById('mode-action');
  const actionTitle = document.getElementById('mode-action-title');

  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      actionTitle.textContent = selectedMode;
      actionEl.style.display = 'block';
      actionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    actionEl.style.display = 'none';
    selectedMode = null;
  });

  document.getElementById('btn-online').addEventListener('click', () => {
    if (!selectedMode) return;
    router.navigate(`/matchmaking?mode=${selectedMode}`);
  });

  document.getElementById('btn-bot').addEventListener('click', async () => {
    if (!selectedMode) return;
    await startBotMatch(selectedMode);
  });
}

async function startBotMatch(mode) {
  try {
    // Force the socket connection and capture the socketId
    socketService.connect();
    let socketId = socketService.getSocketId();

    // Wait until the socket connects (max 3s)
    for (let i = 0; i < 30 && !socketId; i++) {
      await new Promise(r => setTimeout(r, 100));
      socketId = socketService.getSocketId();
    }

    if (!socketId) {
      showToast('Could not establish socket connection. Refreshing...', 'error');
      setTimeout(() => location.reload(), 1500);
      return;
    }

    const result = await api.createBotMatch(mode, socketId);
    showToast('Starting bot match...', 'success');
    router.navigate(`/game/${result.matchId}`);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    console.error('Bot match error:', err);
  }
}
