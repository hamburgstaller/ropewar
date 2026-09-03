/**
 * Time utilities.
 */

module.exports = {
  nowMs: () => Date.now(),
  nowSec: () => Math.floor(Date.now() / 1000)
};
