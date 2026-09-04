/**
 * Game screen.
 * Player avatars on each side hold the rope. The rope's inner endpoint
 * crossing the center line ends the match in favor of the opposing team.
 */

import { router } from '../router.js';
import { socketService } from '../socket.js';
import { showToast } from '../shared/toast.js';
import { escapeHtml } from '../router.js';

let currentMatch = null;
let myTeam = null;
let myUserId = null;
let lastSecondClickCount = 0;
let lastTickTime = 0;
let myCpsHistory = [];   // CPS of recent seconds
let arenaEl = null;      // Cached for avatar positioning math
let lastRopePos = 0;     // For pull-direction visual cue

// Avatar DOM cache. Populated on match_start.
let avatarEls = { A: [], B: [] };
let ropeEl = null;
let ropeKnotEl = null;

const AVATAR_SIZE = 56;
const ROPE_HEIGHT = 10;

export async function renderGame(params) {
  const matchId = params.matchId;
  myUserId = socketService.getUser().userId;
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.add('hidden');

  // Signal to server that this client has loaded the game page.
  // Countdown starts only after all human players are ready,
  // ensuring every player sees "3" on screen.
  socketService.getSocket()?.emit('client:match_ready', { matchId });

  // Initial skeleton — only the arena shell plus click area. Avatars are
  // rendered later in `server:match_start` when we know the player list.
  app.innerHTML = `
    <div class="game-screen">
      <div id="bot-warning" class="bot-warning hidden">
        🤖 Bot maçı — Rank puanı kaydedilmez
      </div>
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

      <div class="arena" id="arena">
        <div class="arena-center-line"></div>
        <div class="rope" id="rope"></div>
        <div class="rope-knot" id="rope-knot"></div>
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
  const timerEl = document.getElementById('game-timer');
  const modeBadge = document.getElementById('mode-badge');
  const myCpsEl = document.getElementById('my-cps');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const botWarningEl = document.getElementById('bot-warning');
  let countdownInterval = null;
  arenaEl = document.getElementById('arena');
  ropeEl = document.getElementById('rope');
  ropeKnotEl = document.getElementById('rope-knot');

  // === EVENT HANDLERS ===
  const handlers = {
    'server:match_start': (data) => {
      modeBadge.textContent = data.mode.toUpperCase();
      // Add mode class to arena for layout-specific heights (3v3, 5v5)
      arenaEl.classList.remove('arena-1v1', 'arena-3v3', 'arena-5v5');
      arenaEl.classList.add('arena-' + data.mode);
      myTeam = data.teamA.some(p => p.userId === myUserId) ? 'A' :
               data.teamB.some(p => p.userId === myUserId) ? 'B' : 'A';
      renderTeamSummary('team-A-summary', data.teamA, 'A');
      renderTeamSummary('team-B-summary', data.teamB, 'B');
      renderAvatars(data.teamA, data.teamB);
      clickBtn.disabled = false;
      countdownOverlay.classList.add('hidden');
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      // Show bot match warning if this is a bot match
      if (data.isBotMatch) {
        botWarningEl.classList.remove('hidden');
      }
      myCpsHistory = [];
      lastSecondClickCount = 0;
      lastTickTime = Date.now();
      lastRopePos = 0;
      updateRope(0);
    },
    'server:countdown': (data) => {
      countdownOverlay.classList.remove('hidden');
      // countdownEndsAt varsa, sunucu bitiş zaman damgasını kullanarak
      // kalan süreyi hesapla — bu sayede bağlantı gecikmesi olsa bile
      // 3'ten geriye doğru sayar.
      if (data.countdownEndsAt) {
        if (countdownInterval) clearInterval(countdownInterval);
        const tick = () => {
          const msLeft = Math.max(0, data.countdownEndsAt - Date.now());
          const secLeft = Math.ceil(msLeft / 1000);
          countdownNumber.textContent = secLeft > 0 ? secLeft : '';
          if (secLeft <= 0 && countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
        };
        tick();
        countdownInterval = setInterval(tick, 100);
      } else {
        countdownNumber.textContent = data.secondsRemaining;
      }
    },
    'server:tick': (data) => {
      // Rope and avatar positions
      updateRope(data.ropePos);

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
      lastRopePos = data.ropePos;
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
    avatarEls = { A: [], B: [] };
    arenaEl = null;
    ropeEl = null;
    ropeKnotEl = null;
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

/**
 * Build the avatar elements for both teams and append them to the arena.
 * Each team's avatars are stacked vertically (1/3/5 players).
 */
function renderAvatars(teamAPlayers, teamBPlayers) {
  if (!arenaEl) return;
  // Clear any old avatars
  for (const el of [...avatarEls.A, ...avatarEls.B]) el.remove();
  avatarEls = { A: [], B: [] };

  const arenaHeight = arenaEl.clientHeight;
  const stackGap = 12;
  const aAvatars = createAvatarStack(teamAPlayers, 'A', arenaHeight, stackGap);
  const bAvatars = createAvatarStack(teamBPlayers, 'B', arenaHeight, stackGap);
  avatarEls.A = aAvatars;
  avatarEls.B = bAvatars;
}

function createAvatarStack(players, team, arenaHeight, gap) {
  const n = players.length;
  // Total stack height: n * AVATAR_SIZE + (n - 1) * gap
  const stackHeight = n * AVATAR_SIZE + (n - 1) * gap;
  // First avatar's top, so the stack is vertically centered
  const startY = Math.max(8, (arenaHeight - stackHeight) / 2);

  const els = [];
  players.forEach((p, idx) => {
    const el = document.createElement('div');
    el.className = `player-avatar team-${team}` + (p.isBot ? ' is-bot' : '') +
                   (p.userId === myUserId ? ' is-me' : '');
    el.style.top = (startY + idx * (AVATAR_SIZE + gap)) + 'px';
    el.dataset.userId = p.userId;
    el.textContent = (p.username || '?').charAt(0).toUpperCase();

    // Name label below avatar
    const name = document.createElement('div');
    name.className = 'player-avatar-name';
    name.textContent = p.username + (p.isBot ? ' 🤖' : '');
    el.appendChild(name);

    arenaEl.appendChild(el);
    els.push(el);
  });
  return els;
}

/**
 * Position the avatars and the rope based on the current `ropePos`.
 *
 * Visual model: both teams' avatars shift toward the winning side. The
 * "inner edge" for A is the rightmost A avatar (the one holding the rope).
 * The "inner edge" for B is the leftmost B avatar. They move in OPPOSITE
 * directions: when A wins, A's inner edge moves left (toward A's corner)
 * AND B's inner edge moves left too (B is being dragged toward A's side).
 * When B wins, both move right.
 *
 * Win visual: at ropePos = -50, A's inner edge reaches the leftmost extent
 * of the arena, and B's inner edge crosses the center line — meaning A has
 * pulled B across. At ropePos = +50, the opposite. This matches the
 * server's `|ropePos| >= 50` win condition while making the rope look
 * "attached" to the players.
 */
function updateRope(ropePos) {
  if (!arenaEl || !ropeEl) return;
  const arenaRect = arenaEl.getBoundingClientRect();
  const arenaW = arenaRect.width;
  const arenaH = arenaRect.height;

  // Normalize ropePos from [-50, +50] to [-1, +1]
  const t = Math.max(-1, Math.min(1, ropePos / 50));

  // Inner edges at rest (ropePos=0): A's rightmost avatar center at 22% of
  // arenaW, B's leftmost avatar center at 78% of arenaW. This gives a clear
  // gap in the middle for the rope to be visible.
  const restA = arenaW * 0.22;
  const restB = arenaW * 0.78;
  // The center line is the win threshold. We pick the travel distance so
  // that the OPPOSING side's inner edge exactly reaches the center at
  // full rope travel. Travel is symmetric.
  const center = arenaW / 2;
  const travelPx = restB - center;  // 0.28 * arenaW

  // A's inner edge: moves in the SAME direction as t (right when B wins).
  // B's inner edge: moves in the SAME direction as t (right when B wins).
  // Both inner edges shift together; the rope is the segment between them.
  // When t = +1, A's inner edge reaches the center → A loses.
  // When t = -1, B's inner edge reaches the center → B loses.
  // To keep avatars from going off-screen, clamp the inner edges to the
  // arena's visible region (with avatar-size padding).
  const minX = AVATAR_SIZE / 2;
  const maxX = arenaW - AVATAR_SIZE / 2;
  const aCenter = Math.max(minX, Math.min(maxX, restA + t * travelPx));
  const bCenter = Math.max(minX, Math.min(maxX, restB + t * travelPx));

  // Position A avatars: their rightmost (last) avatar has center at aCenter.
  if (avatarEls.A.length > 0) {
    const stackGap = 12;
    const lastIdx = avatarEls.A.length - 1;
    avatarEls.A.forEach((el, idx) => {
      const offset = (lastIdx - idx) * (AVATAR_SIZE + stackGap);
      const cx = aCenter - offset;
      el.style.left = (cx - AVATAR_SIZE / 2) + 'px';
    });
  }
  // Position B avatars: their leftmost (first) avatar has center at bCenter.
  if (avatarEls.B.length > 0) {
    const stackGap = 12;
    avatarEls.B.forEach((el, idx) => {
      const offset = idx * (AVATAR_SIZE + stackGap);
      const cx = bCenter + offset;
      el.style.left = (cx - AVATAR_SIZE / 2) + 'px';
    });
  }

  // Rope: from the right edge of the rightmost A avatar to the left edge of
  // the leftmost B avatar. Rope top is at arena vertical center.
  const ropeLeft = aCenter;
  const ropeWidth = Math.max(0, bCenter - aCenter);
  ropeEl.style.left = ropeLeft + 'px';
  ropeEl.style.width = ropeWidth + 'px';
  ropeEl.style.top = (arenaH / 2 - ROPE_HEIGHT / 2) + 'px';
  // Knot at the geometric center of the rope
  ropeKnotEl.style.left = (ropeLeft + ropeWidth / 2) + 'px';
  ropeKnotEl.style.top = (arenaH / 2) + 'px';

  // Pull-direction visual: highlight the team currently winning the race
  const pullingA = ropePos < 0;
  const pullingB = ropePos > 0;
  for (const el of avatarEls.A) el.classList.toggle('pulling', pullingA);
  for (const el of avatarEls.B) el.classList.toggle('pulling', pullingB);
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
