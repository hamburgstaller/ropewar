/**
 * Matchmaking waiting screen.
 */

import { router } from '../router.js';
import { socketService } from '../socket.js';
import { showToast } from '../shared/toast.js';

export async function renderMatchmaking(params, query) {
  const mode = query.mode || '1v1';
  const app = document.getElementById('app');
  let elapsed = 0;
  document.getElementById('navbar').classList.remove('hidden');

  app.innerHTML = `
    <div class="container">
      <div class="card matchmaking-card">
        <h2>${mode} Matchmaking</h2>
        <div class="spinner"></div>
        <p id="matchmaking-status">Searching for an opponent...</p>
        <p id="matchmaking-elapsed" style="color: var(--text-dim); margin-top: 8px;">0 seconds</p>
        <button id="cancel-btn" class="btn-secondary" style="margin-top: 24px;">Cancel</button>
      </div>
    </div>
  `;

  // Connect socket
  socketService.connect();

  // Event listeners
  const onQueueJoined = (data) => {
    document.getElementById('matchmaking-status').textContent =
      `In queue, position ${data.position} of ${data.totalNeeded}...`;
  };
  const onMatchFound = (data) => {
    cleanup();
    showToast('Match found!', 'success');
    router.navigate(`/game/${data.matchId}`);
  };
  const onError = (data) => {
    document.getElementById('matchmaking-status').textContent = data.message || 'An error occurred';
  };

  function cleanup() {
    socketService.off('server:queue_joined', onQueueJoined);
    socketService.off('server:match_found', onMatchFound);
    socketService.off('server:error', onError);
    clearInterval(timerInterval);
  }

  socketService.on('server:queue_joined', onQueueJoined);
  socketService.on('server:match_found', onMatchFound);
  socketService.on('server:error', onError);

  // Cancel
  document.getElementById('cancel-btn').addEventListener('click', () => {
    socketService.emit('client:leave_queue');
    cleanup();
    router.navigate('/menu');
  });

  // Join the queue
  socketService.emit('client:join_queue', { mode });

  // Elapsed timer
  const timerInterval = setInterval(() => {
    elapsed++;
    const el = document.getElementById('matchmaking-elapsed');
    if (el) el.textContent = `${elapsed} seconds`;
  }, 1000);

  // Save cleanup
  router.setCleanup(cleanup);
}
