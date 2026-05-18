const logger = require('./logger');

const riskState = {
  lastTradeTimes: {},
  dailyTrades: 0
};

const RISK_CONFIG = {
  cooldownMs: 5 * 60 * 1000, // 5 minutes cooldown per instrument
  maxTradesPerHour: 10,
  minRRRatio: 2.0
};

/**
 * Validates if it's safe to take a trade based on risk params
 */
const validateRisk = (instrumentId) => {
  const now = Date.now();
  const lastTradeTime = riskState.lastTradeTimes[instrumentId] || 0;

  if (now - lastTradeTime < RISK_CONFIG.cooldownMs) {
    logger.warn(`[Risk Management] Cooldown active for ${instrumentId}`);
    return false;
  }

  // TODO: Add max trades per hour logic
  return true;
};

const registerTrade = (instrumentId) => {
  riskState.lastTradeTimes[instrumentId] = Date.now();
  riskState.dailyTrades++;
};

module.exports = { validateRisk, registerTrade, RISK_CONFIG };
