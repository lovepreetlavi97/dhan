const { EMA, MACD, RSI, ATR, VWAP, BollingerBands, StochasticRSI } = require('technicalindicators');

const getEMA = (prices, period) => EMA.calculate({ period, values: prices });
const getRSI = (prices, period = 14) => RSI.calculate({ period, values: prices });
const getMACD = (prices) => MACD.calculate({ values: prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
const getATR = (highs, lows, closes, period = 14) => ATR.calculate({ high: highs, low: lows, close: closes, period });
const getVWAP = (highs, lows, closes, volumes) => VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });
const getBollingerBands = (prices, period = 20, stdDev = 2) => BollingerBands.calculate({ period, values: prices, stdDev });
const getStochRSI = (prices, rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) => StochasticRSI.calculate({ values: prices, rsiPeriod, stochasticPeriod: stochPeriod, kPeriod, dPeriod });

const getSupertrend = (highs, lows, closes, period = 10, multiplier = 3) => {
  const atr = getATR(highs, lows, closes, period);
  if (atr.length === 0) return [];
  const supertrend = [];
  let isUp = true;
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { supertrend.push(null); continue; }
    const basicUpper = ((highs[i] + lows[i]) / 2) + (multiplier * atr[i - period]);
    const basicLower = ((highs[i] + lows[i]) / 2) - (multiplier * atr[i - period]);
    
    if (isUp && closes[i] < basicLower) isUp = false;
    else if (!isUp && closes[i] > basicUpper) isUp = true;
    
    supertrend.push({ value: isUp ? basicLower : basicUpper, isUp });
  }
  return supertrend.filter(x => x !== null);
};

const detectVolumeSpike = (volumes, period = 20) => {
  if (volumes.length < period) return false;
  const recent = volumes.slice(-period - 1, -1);
  const avg = recent.reduce((a, b) => a + b, 0) / period;
  const current = volumes[volumes.length - 1];
  return current > avg * 2.5;
};

// OI Logic
const analyzeOI = (currentOi, prevOi, priceChange) => {
  if (!currentOi || !prevOi || currentOi === prevOi) return { status: 'NEUTRAL' };
  if (currentOi > prevOi && priceChange > 0) return { status: 'PUT_WRITING_BULLISH' };
  if (currentOi > prevOi && priceChange < 0) return { status: 'CALL_WRITING_BEARISH' };
  if (currentOi < prevOi && priceChange > 0) return { status: 'SHORT_COVERING_BULLISH' };
  if (currentOi < prevOi && priceChange < 0) return { status: 'LONG_UNWINDING_BEARISH' };
  return { status: 'NEUTRAL' };
};

module.exports = { getEMA, getRSI, getMACD, getATR, getVWAP, getBollingerBands, getStochRSI, getSupertrend, detectVolumeSpike, analyzeOI };
