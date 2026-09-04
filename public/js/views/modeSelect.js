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
        <div id="bot-difficulty" style="margin-top: 16px; display: none;">
          <p style="color: var(--text-dim); margin-bottom: 8px;">Bot Difficulty:</p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="diff-btn" data-diff="easy">😊 Easy</button>
            <button class="diff-btn" data-diff="normal" selected>😎 Normal</button>
            <button class="diff-btn" data-diff="hard">😈 Hard</button>
          </div>
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

  let selectedDifficulty = 'normal';

  document.getElementById('btn-bot').addEventListener('click', async () => {
    if (!selectedMode) return;
    await startBotMatch(selectedMode, selectedDifficulty);
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = btn.dataset.diff;
    });
  });

  document.getElementById('bot-difficulty').style.display = 'block';
  // Set initial active state for normal difficulty
  document.querySelector('.diff-btn[data-diff="normal"]')?.classList.add('active');
}

async function startBotMatch(mode, difficulty = 'normal') {
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

    // Check if this is a bot-only match (no humans beyond the player)
    // Show warning that rank will not be updated
    if (!confirm('Bot maçı: Rank puanı kaydedilmez. Devam etmek istiyor musunuz?')) {
      return;
    }

    const result = await api.createBotMatch(mode, socketId, difficulty);
    showToast('Starting bot match...', 'info');
    router.navigate(`/game/${result.matchId}`);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    console.error('Bot match error:', err);
  }
}
