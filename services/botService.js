/**
 * Bot AI service.
 * Bots do not emit click events; their clicks are written directly into
 * the per-tick counter. This keeps the rate-based mechanic consistent.
 */

const cfg = require('../config/gameConfig');

let botIdCounter = 0;

function nextBotId() {
  return `bot_${++botIdCounter}_${Date.now()}`;
}

function gaussian() {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const botService = {
  /**
   * Create a bot profile.
   * @param {string} difficulty - 'easy' | 'normal' | 'hard'
   * @param {string} team - 'A' | 'B'
   * @returns {object} Bot player object
   */
  createBot(difficulty = cfg.BOT_DEFAULT_DIFFICULTY, team = 'A') {
    const profile = cfg.BOT_DIFFICULTY[difficulty] || cfg.BOT_DIFFICULTY[cfg.BOT_DEFAULT_DIFFICULTY];
    return {
      userId: nextBotId(),
      username: `Bot [${difficulty}]`,
      team,
      isBot: true,
      difficulty,
      _profile: profile
    };
  },

  /**
   * Generate the number of clicks for the next second for the given bot.
   * Added to clicksThisSecond[team] before broadcasting the tick.
   */
  generateClicks(bot) {
    const { meanCps, jitter, misfireRate } = bot._profile;
    let cps = meanCps + gaussian() * jitter;
    if (Math.random() < misfireRate) cps *= 0.5;
    return Math.max(0, Math.round(cps));
  },

  /**
   * Create a full team of bots.
   * @param {number} size - team size
   * @param {string} team - 'A' | 'B'
   * @param {string} difficulty
   * @returns {Array<bot>}
   */
  createTeam(size, team, difficulty = cfg.BOT_DEFAULT_DIFFICULTY) {
    const teamArr = [];
    for (let i = 0; i < size; i++) {
      const bot = this.createBot(difficulty, team);
      bot.username = `Bot ${i + 1} [${difficulty}]`;
      teamArr.push(bot);
    }
    return teamArr;
  },

  /**
   * Generate the total clicks for all bots on a team for the next tick.
   * @returns {number} value to add into clicksThisSecond[team]
   */
  teamClicksForNextTick(team) {
    let total = 0;
    for (const p of team) {
      if (p.isBot) {
        total += this.generateClicks(p);
      }
    }
    return total;
  }
};

module.exports = botService;
