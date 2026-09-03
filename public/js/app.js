/**
 * Application entry point.
 * Auth check, route registrations, router startup.
 */

import { router } from './router.js';
import { api } from './api.js';
import { socketService } from './socket.js';
import { renderLogin } from './views/login.js';
import { renderRegister } from './views/register.js';
import { renderMenu } from './views/menu.js';
import { renderModeSelect } from './views/modeSelect.js';
import { renderMatchmaking } from './views/matchmaking.js';
import { renderGame } from './views/game.js';
import { renderResults } from './views/results.js';
import { renderProfile } from './views/profile.js';
import { renderLeaderboard } from './views/leaderboard.js';

const PUBLIC_ROUTES = new Set(['/login', '/register']);

// === AUTH CHECK ===
async function ensureAuth() {
  try {
    const { user } = await api.me();
    socketService.setUser(user.id, user.username);
    updateNavbar(user);
    socketService.connect();
    return user;
  } catch (err) {
    return null;
  }
}

function updateNavbar(user) {
  const nav = document.getElementById('navbar');
  const navUser = document.getElementById('nav-user');
  if (user) {
    nav.classList.remove('hidden');
    navUser.textContent = user.username;
    navUser.className = `tier-${user.rank_tier} nav-user`;
  } else {
    nav.classList.add('hidden');
  }
}

// === ROUTE WRAPPER (auth guard) ===
function authGuard(handler) {
  return async (params, query) => {
    const path = window.location.hash.slice(1) || '/menu';
    if (PUBLIC_ROUTES.has(path)) {
      return handler(params, query);
    }
    const user = await ensureAuth();
    if (!user) {
      router.navigate('/login');
      return;
    }
    return handler(params, query);
  };
}

// === ROUTE REGISTRATIONS ===
router.register('/login', authGuard(renderLogin));
router.register('/register', authGuard(renderRegister));
router.register('/menu', authGuard(renderMenu));
router.register('/play', authGuard(renderModeSelect));
router.register('/matchmaking', authGuard(renderMatchmaking));
router.register('/game/:matchId', authGuard(renderGame));
router.register('/results/:matchId', authGuard(renderResults));
router.register('/profile', authGuard(renderProfile));
router.register('/leaderboard', authGuard(renderLeaderboard));

// === NAVBAR LOGOUT ===
document.getElementById('nav-logout').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await api.logout();
  } catch (err) {
    console.error('Logout error:', err);
  }
  // Socket disconnect
  if (socketService.getSocket()) socketService.getSocket().disconnect();
  updateNavbar(null);
  router.navigate('/login');
});

// === AUTH EVENTS ===
window.addEventListener('auth:login', (e) => {
  updateNavbar(e.detail);
  socketService.setUser(e.detail.id, e.detail.username);
  socketService.connect();
});

// === START ===
router.start();
