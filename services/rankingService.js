/**
 * Rank tier resolution.
 */

const cfg = require('../config/gameConfig');

module.exports = {
  /**
   * Returns the tier name for the given MMR.
   */
  tierFor(mmr) {
    for (const tier of cfg.TIERS) {
      if (mmr >= tier.min && mmr <= tier.max) return tier.name;
    }
    return cfg.TIERS[0].name;
  },

  /**
   * Color code for a tier.
   */
  colorFor(tierName) {
    const t = cfg.TIERS.find(t => t.name === tierName);
    return t ? t.color : '#888';
  },

  /**
   * Return all tiers (for UI).
   */
  allTiers() {
    return cfg.TIERS;
  }
};
