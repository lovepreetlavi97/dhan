const { EMA, MACD, RSI, ATR, VWAP, BollingerBands, StochasticRSI } = require('technicalindicators');

const getEMA = (prices, period) => {
  return EMA.calculate({ period, values: prices });
};

const getRSI = (prices, period = 14) => {
  return RSI.calculate({ period, values: prices });
};

const getMACD = (prices) => {
  return MACD.calculate({
    values: prices,
    fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false
  });
};

const getATR = (highs, lows, closes, period = 14) => {
  return ATR.calculate({ high: highs, low: lows, close: closes, period });
};

const getVWAP = (highs, lows, closes, volumes) => {
  return VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });
};

const getBollingerBands = (prices, period = 20, stdDev = 2) => {
  return BollingerBands.calculate({ period, values: prices, stdDev });
};

const getStochRSI = (prices, rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) => {
  return StochasticRSI.calculate({ values: prices, rsiPeriod, stochasticPeriod: stochPeriod, kPeriod, dPeriod });
};

// Simplified Supertrend implementation assuming standard 10/3 multiplier
const getSupertrend = (highs, lows, closes, period = 10, multiplier = 3) => {
  // To avoid bringing in complex custom packages, we'll approximate trend directly in strategy,
  // or return an empty array if full library isn't available. 
  // technicalindicators doesn't have native Supertrend.
  return []; 
};

/**
 * Custom Volume Spike Detection
 * True if current volume is > 2.5x the average of last N periods
 */
const detectVolumeSpike = (volumes, period = 20) => {
  if (volumes.length < period) return false;
  const recent = volumes.slice(-period - 1, -1);
  const avg = recent.reduce((a, b) => a + b, 0) / period;
  const current = volumes[volumes.length - 1];
  return current > avg * 2.5;
};

module.exports = {
  getEMA, getRSI, getMACD, getATR, getVWAP, getBollingerBands, getStochRSI, getSupertrend, detectVolumeSpike
};
