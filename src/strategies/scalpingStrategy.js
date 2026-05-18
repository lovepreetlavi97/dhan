const { getEMA, getRSI, getVWAP, getMACD, detectVolumeSpike, getATR } = require('../indicators');
const { analyzeOI } = require('../optionchain/analyzer');
const { sendAlert } = require('../telegram/bot');
const { validateRisk, registerTrade } = require('../utils/riskManagement');
const logger = require('../utils/logger');

// Throttling logger to prevent spam
let lastLogTime = 0;

const evaluateScalpStrategy = async (instrumentId, currentCandle, history) => {
  if (!history || history.length < 50) return; // Need minimum 50 periods

  const closes = history.map(c => c.close).concat([currentCandle.close]);
  const highs = history.map(c => c.high).concat([currentCandle.high]);
  const lows = history.map(c => c.low).concat([currentCandle.low]);
  const volumes = history.map(c => c.volume).concat([currentCandle.volume]);

  const ema9 = getEMA(closes, 9);
  const ema20 = getEMA(closes, 20);
  const vwap = getVWAP(highs, lows, closes, volumes);
  const rsi = getRSI(closes, 14);
  const macd = getMACD(closes);
  const atr = getATR(highs, lows, closes, 14);
  const volSpike = detectVolumeSpike(volumes);

  const lastPrice = currentCandle.close;
  const lEMA9 = ema9[ema9.length - 1];
  const lEMA20 = ema20[ema20.length - 1];
  const lVWAP = vwap[vwap.length - 1];
  const lRSI = rsi[rsi.length - 1];
  const lMACD = macd[macd.length - 1];
  const lATR = atr[atr.length - 1];

  // Option Chain Mock
  const oiAnalysis = analyzeOI(
    { oiChange: 1000, priceChange: -5, totalOi: 100000 }, 
    { oiChange: 5000, priceChange: -2, totalOi: 150000 }
  );

  // Print realtime logs (Throttled to once every 5 seconds per tick)
  const now = Date.now();
  if (now - lastLogTime > 5000) {
    console.log(`\n--- Realtime Log [${instrumentId}] ---`);
    console.log(`Price: ${lastPrice}`);
    console.log(`VWAP:  ${lVWAP ? lVWAP.toFixed(2) : 'N/A'}`);
    console.log(`EMA9:  ${lEMA9 ? lEMA9.toFixed(2) : 'N/A'}`);
    console.log(`EMA20: ${lEMA20 ? lEMA20.toFixed(2) : 'N/A'}`);
    console.log(`RSI:   ${lRSI ? lRSI.toFixed(2) : 'N/A'}`);
    console.log(`MACD:  ${lMACD ? lMACD.histogram.toFixed(2) : 'N/A'}`);
    console.log(`Volume: ${currentCandle.volume}`);
    console.log(`OI:    ${currentCandle.oi}`);
    lastLogTime = now;
  }

  // 1. Risk Check
  if (!validateRisk(instrumentId)) return;

  let signalTriggered = false;
  let type = '';
  let confidence = 0;
  let reasons = [];

  const macdBullish = lMACD && lMACD.histogram > 0;
  const macdBearish = lMACD && lMACD.histogram < 0;

  // BULLISH CE SETUP
  if (lastPrice > lVWAP && lEMA9 > lEMA20 && lRSI > 60 && macdBullish && volSpike && oiAnalysis.putWriting) {
    reasons.push('Above VWAP', 'EMA Bullish', 'RSI Strong', 'MACD Bullish', 'Volume Spike', 'Put Writing Increase');
    confidence = 80 + oiAnalysis.strength;
    signalTriggered = true;
    type = 'BUY CE';
  }

  // BEARISH PE SETUP
  if (lastPrice < lVWAP && lEMA9 < lEMA20 && lRSI < 40 && macdBearish && volSpike && oiAnalysis.callWriting) {
    reasons.push('Below VWAP', 'EMA Bearish', 'RSI Weak', 'MACD Bearish', 'Volume Spike', 'Call Writing Increase');
    confidence = 80 + oiAnalysis.strength;
    signalTriggered = true;
    type = 'BUY PE';
  }

  if (signalTriggered) {
    registerTrade(instrumentId);
    
    const riskAmount = lATR * 1.5;
    const stopLoss = type === 'BUY CE' ? lastPrice - riskAmount : lastPrice + riskAmount;
    const target = type === 'BUY CE' ? lastPrice + (riskAmount * 2) : lastPrice - (riskAmount * 2);

    const msg = `
<b>${instrumentId} SCALPING ALERT</b>

<b>Signal:</b> ${type}
<b>Confidence:</b> ${Math.min(confidence, 99)}%

<b>Indicators:</b>
${reasons.map(r => `• ${r}`).join('\n')}

<b>Entry:</b> ${lastPrice.toFixed(2)}
<b>Stop Loss:</b> ${stopLoss.toFixed(2)}
<b>Target:</b> ${target.toFixed(2)}
    `;
    await sendAlert(msg);
  }
};

module.exports = { evaluateScalpStrategy };
