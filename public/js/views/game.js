/**
 * Game screen.
 * Rope, click button, countdown, timer, results.
 */

import { router } from '../router.js';
import { socketService } from '../socket.js';
import { showToast } from '../shared/toast.js';
import { escapeHtml } from '../router.js';

let currentMatch = null;
let myTeam = null;
let myUserId = null;
let clickCount = 0;
let lastSecondClickCount = 0;
let lastTickTime = 0;
let myCpsHistory = [];   // CPS of recent seconds

export async function renderGame(params) {
  const matchId = params.matchId;
  myUserId = socketService.getUser().userId;
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.add('hidden');

  // Initial skeleton
  app.innerHTML = `
    <div class="game-screen">
      <div class="game-header">
        <div class="team-summary team-A" id="team-A-summary">
          <span class="team-label">TEAM A</span>
          <div class="team-cps" id="cps-A">0 clk/s</div>
        </div>
        <div>
          <div class="game-mode-badge" id="mode-badge">—</div>
          <div class="game-timer" id="game-timer">01:00</div>
        </div>
        <div class="team-summary team-B" id="team-B-summary">
          <span class="team-label">TEAM B</span>
          <div class="team-cps" id="cps-B">0 clk/s</div>
        </div>
      </div>

      <div class="arena">
        <div class="arena-center"></div>
        <div class="rope"></div>
        <div class="rope-flag" id="rope-flag"></div>
      </div>

      <div class="click-area" id="click-area" style="position: relative;">
        <button class="click-button" id="click-button" disabled>CLICK!</button>
        <div class="click-stats">
          Your CPS (last second)
          <span class="cps" id="my-cps">0</span>
        </div>
      </div>

      <div id="countdown-overlay" class="countdown-overlay hidden">
        <div class="countdown-number" id="countdown-number">3</div>
        <div class="countdown-text">Get ready...</div>
      </div>
    </div>
  `;

  currentMatch = { id: matchId };
  const clickBtn = document.getElementById('click-button');
  const clickArea = document.getElementById('click-area');
  const flag = document.getElementById('rope-flag');
  const timerEl = document.getElementById('game-timer');
  const modeBadge = document.getElementById('mode-badge');
  const myCpsEl = document.getElementById('my-cps');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');

  // === EVENT HANDLERS ===
  const handlers = {
    'server:match_start': (data) => {
      modeBadge.textContent = data.mode.toUpperCase();
      myTeam = data.teamA.some(p => p.userId === myUserId) ? 'A' :
               data.teamB.some(p => p.userId === myUserId) ? 'B' : 'A';
      renderTeamSummary('team-A-summary', data.teamA, 'A');
      renderTeamSummary('team-B-summary', data.teamB, 'B');
      clickBtn.disabled = false;
      countdownOverlay.classList.add('hidden');
      myCpsHistory = [];
      clickCount = 0;
      lastTickTime = Date.now();
    },
    'server:countdown': (data) => {
      countdownOverlay.classList.remove('hidden');
      countdownNumber.textContent = data.secondsRemaining;
    },
    'server:tick': (data) => {
      // Update rope
      const pct = data.ropePos / 50;   // -1 .. 1
      flag.style.transform = `translate(calc(-50% + ${pct * 50}%), -50%)`;

      // Timer
      const m = Math.floor(data.timeLeft / 60);
      const s = data.timeLeft % 60;
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // Update team CPS from server tick
      const cpsAEl = document.getElementById('cps-A');
      const cpsBEl = document.getElementById('cps-B');
      if (cpsAEl) cpsAEl.textContent = `${data.clicksA} clk/s`;
      if (cpsBEl) cpsBEl.textContent = `${data.clicksB} clk/s`;

      // Compute CPS
      const now = Date.now();
      const elapsedSec = (now - lastTickTime) / 1000;
      if (elapsedSec > 0 && lastSecondClickCount > 0) {
        myCpsHistory.push(lastSecondClickCount);
        if (myCpsHistory.length > 5) myCpsHistory.shift();
        const avg = myCpsHistory.reduce((a, b) => a + b, 0) / myCpsHistory.length;
        myCpsEl.textContent = avg.toFixed(1);
      }
      lastSecondClickCount = 0;
      lastTickTime = now;
    },
    'server:match_end': (data) => {
      // Persist the result in sessionStorage so the results view can read it on navigation
      try {
        sessionStorage.setItem(`matchResult:${matchId}`, JSON.stringify(data));
      } catch (e) { /* ignore */ }
      cleanup();
      router.navigate(`/results/${matchId}`);
    },
    'server:error': (data) => {
      showToast(data.message || 'Error', 'error');
    },
    'server:match_state': (data) => {
      if (!data.active) {
        showToast('No active match', 'error');
        router.navigate('/menu');
      }
    }
  };

  for (const [ev, fn] of Object.entries(handlers)) {
    socketService.on(ev, fn);
  }

  function cleanup() {
    for (const [ev, fn] of Object.entries(handlers)) {
      socketService.off(ev, fn);
    }
    clickBtn.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
  }

  // === CLICK ===
  function onClick(e) {
    if (clickBtn.disabled) return;
    doClick(e.clientX || 0, e.clientY || 0);
  }
  function onKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!clickBtn.disabled) doClick(0, 0);
    }
  }
  function doClick(x, y) {
    socketService.emit('client:click', { matchId });
    lastSecondClickCount++;
    clickCount++;
    // Floating +1
    if (x && y) {
      const float = document.createElement('div');
      float.className = 'click-float';
      float.textContent = '+1';
      float.style.left = (x - clickArea.getBoundingClientRect().left) + 'px';
      float.style.top = (y - clickArea.getBoundingClientRect().top) + 'px';
      clickArea.appendChild(float);
      setTimeout(() => float.remove(), 800);
    }
  }
  clickBtn.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  router.setCleanup(cleanup);

  // After a page refresh, ask the server to resume the match state
  setTimeout(() => {
    socketService.emit('client:resume_match');
  }, 500);
}

function renderTeamSummary(elementId, players, team) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <span class="team-label">TEAM ${team}</span>
    <div class="team-cps" id="cps-${team}">0 clk/s</div>
    <div style="display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem; color: var(--text-dim); text-align: ${team === 'A' ? 'right' : 'left'}; width: 100%;">
      ${players.map(p => `<div>${escapeHtml(p.username)}${p.isBot ? ' 🤖' : ''}</div>`).join('')}
    </div>
  `;
}
