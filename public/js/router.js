/**
 * Hash-based router.
 * Views are loaded as ESM modules.
 */

const routes = new Map();
let currentCleanup = null;
let currentView = null;

export const router = {
  /**
   * Register a route.
   * pattern: '/login', '/game/:matchId', '/results/:matchId'
   * handler: async (params, query) => HTMLElement | string
   */
  register(pattern, handler) {
    routes.set(pattern, handler);
  },

  async navigate(path, options = {}) {
    if (window.location.hash !== `#${path}`) {
      // Write state to sessionStorage; hashchange will trigger _renderCurrent
      if (options.state) {
        sessionStorage.setItem('routerState', JSON.stringify(options.state));
      } else {
        sessionStorage.removeItem('routerState');
      }
      window.location.hash = path;
      return;  // hashchange will fire
    } else {
      if (options.state) {
        sessionStorage.setItem('routerState', JSON.stringify(options.state));
      }
      await this._renderCurrent();
    }
  },

  async _renderCurrent() {
    const hash = window.location.hash.slice(1) || '/menu';
    const [path, queryStr] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryStr || ''));

    // Read state from sessionStorage
    let state = null;
    try {
      const stateStr = sessionStorage.getItem('routerState');
      if (stateStr) {
        state = JSON.parse(stateStr);
        sessionStorage.removeItem('routerState');  // use only once
      }
    } catch (e) { /* ignore */ }

    // Find matching route
    for (const [pattern, handler] of routes) {
      const params = matchRoute(pattern, path);
      if (params) {
        // Cleanup previous view
        if (currentCleanup) {
          try { currentCleanup(); } catch (e) { console.error(e); }
        }
        const app = document.getElementById('app');
        app.innerHTML = '';
        try {
          const result = await handler(params, query, state);
          if (typeof result === 'string') {
            app.innerHTML = result;
          } else if (result instanceof HTMLElement) {
            app.appendChild(result);
          }
          currentView = pattern;
        } catch (err) {
          console.error('View render error:', err);
          app.innerHTML = `<div class="center-page"><div class="card"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div></div>`;
        }
        return;
      }
    }

    // 404
    document.getElementById('app').innerHTML =
      `<div class="center-page"><div class="card"><h2>Page not found</h2><a href="#/menu">Main menu</a></div></div>`;
  },

  setCleanup(fn) {
    currentCleanup = fn;
  },

  start() {
    window.addEventListener('hashchange', () => this._renderCurrent());
    this._renderCurrent();
  }
};

function matchRoute(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { escapeHtml };
