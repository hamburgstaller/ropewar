/**
 * About page - Game info, updates, and how to play.
 */

import { escapeHtml } from '../router.js';

export async function renderAbout() {
  const app = document.getElementById('app');
  document.getElementById('navbar').classList.remove('hidden');

  app.innerHTML = `
    <div class="container">
      <div class="card about-card">
        <h1>🪢 About Rope War</h1>

        <section class="about-section">
          <h2>🎮 How to Play</h2>
          <div class="how-to-content">
            <div class="how-to-step">
              <span class="step-number">1</span>
              <div class="step-content">
                <h3>Join a Match</h3>
                <p>Choose a game mode (1v1, 3v3, or 5v5) and join the queue. You can also play against bots with different difficulty levels.</p>
              </div>
            </div>
            <div class="how-to-step">
              <span class="step-number">2</span>
              <div class="step-content">
                <h3>Click to Pull</h3>
                <p>Click the button or press <kbd>Space</kbd> / <kbd>Enter</kbd> as fast as you can! Each click contributes to your team's pulling power.</p>
              </div>
            </div>
            <div class="how-to-step">
              <span class="step-number">3</span>
              <div class="step-content">
                <h3>Win the Match</h3>
                <p>Pull the rope to your side by clicking faster than the opposing team. Cross the center line to win! If time runs out, the team ahead wins.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="about-section">
          <h2>📋 Game Modes</h2>
          <div class="modes-grid">
            <div class="mode-card">
              <h3>1v1</h3>
              <p>One-on-one battle. Pure skill vs skill.</p>
            </div>
            <div class="mode-card">
              <h3>3v3</h3>
              <p>Team of 3 players. Coordinate with your team!</p>
            </div>
            <div class="mode-card">
              <h3>5v5</h3>
              <p>Full team battle. Maximum chaos!</p>
            </div>
          </div>
        </section>

        <section class="about-section">
          <h2>🤖 Bot Difficulty</h2>
          <div class="difficulty-list">
            <div class="difficulty-item">
              <span class="difficulty-badge easy">Easy</span>
              <span>Relaxed pace, good for beginners</span>
            </div>
            <div class="difficulty-item">
              <span class="difficulty-badge normal">Normal</span>
              <span>Competitive but beatable</span>
            </div>
            <div class="difficulty-item">
              <span class="difficulty-badge hard">Hard</span>
              <span>Maximum challenge for skilled players</span>
            </div>
          </div>
        </section>

        <section class="about-section">
          <h2>📢 Updates</h2>
          <div class="changelog">
            <div class="changelog-item">
              <div class="changelog-header">
                <span class="changelog-version">v1.1</span>
                <span class="changelog-date">September 2026</span>
              </div>
              <ul class="changelog-features">
                <li>Added bot difficulty selection (Easy, Normal, Hard)</li>
                <li>Bot match warning banner added</li>
                <li>Fixed countdown reliability for synchronized game start</li>
                <li>GitHub link added to navigation</li>
                <li>Fixed "You Lost" bug in bot match results</li>
              </ul>
            </div>
            <div class="changelog-item">
              <div class="changelog-header">
                <span class="changelog-version">v1.0</span>
                <span class="changelog-date">Initial Release</span>
              </div>
              <ul class="changelog-features">
                <li>Core game mechanics: click-to-pull rope war</li>
                <li>Three game modes: 1v1, 3v3, 5v5</li>
                <li>Online multiplayer with matchmaking</li>
                <li>Bot opponents for solo play</li>
                <li>MMR ranking system with tiers</li>
                <li>Leaderboard and match history</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="about-section">
          <h2>🔗 Links</h2>
          <div class="links-grid">
            <a href="https://github.com/hamburgstaller/ropewar" target="_blank" rel="noopener" class="link-card">
              <span class="link-icon">📂</span>
              <span>View Source Code</span>
            </a>
          </div>
        </section>

      </div>
    </div>
  `;
}
