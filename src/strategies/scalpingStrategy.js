const { getEMA, getRSI, getVWAP, getMACD, getATR } = require('../indicators');
const { sendAlert } = require('../telegram/bot');
const logger = require('../utils/logger');
const { optionChainStore } = require('../optionchain');

const IDS = {
  "13": "NIFTY",
  "25": "BANKNIFTY",
  "51": "SENSEX"
};

const marketState = {
  "13": { status: 'NEUTRAL', data: {} },
  "25": { status: 'NEUTRAL', data: {} },
  "51": { status: 'NEUTRAL', data: {} }
};

let lastLogTime = 0;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 5 * 60 * 1000;

const evaluateMultiIndexStrategy = async (instrumentId, currentCandle, history) => {
  if (!IDS[instrumentId]) return;

  const closes = history.map(c => c.close).concat([currentCandle.close]);
  const opens = history.map(c => c.open).concat([currentCandle.open]);
  const highs = history.map(c => c.high).concat([currentCandle.high]);
  const lows = history.map(c => c.low).concat([currentCandle.low]);
  const volumes = history.map(c => c.volume).concat([currentCandle.volume]);

  if (closes.length < 50) return;

  const ema9 = getEMA(closes, 9);
  const ema20 = getEMA(closes, 20);
  const vwap = getVWAP(highs, lows, closes, volumes);
  const rsi = getRSI(closes, 14);
  const macd = getMACD(closes);
  
  const lastPrice = currentCandle.close;
  const lastOpen = currentCandle.open;
  const lastHigh = currentCandle.high;
  const lastLow = currentCandle.low;
  const currentVolume = currentCandle.volume;

  const prevCandle = history[history.length - 1];
  const prevHigh = prevCandle.high;
  const prevLow = prevCandle.low;
  const prevVolume = prevCandle.volume;
  const isPrevBullish = prevCandle.close > prevCandle.open;
  
  const prevPrevHigh = history[history.length - 2].high;
  const prevPrevLow = history[history.length - 2].low;
  
  const lEMA9 = ema9[ema9.length - 1];
  const lEMA20 = ema20[ema20.length - 1];
  const lVWAP = vwap[vwap.length - 1];
  const lRSI = rsi[rsi.length - 1];
  const lMACD = macd[macd.length - 1] ? macd[macd.length - 1].histogram : 0;
  
  // Sideways avoidance
  const sideways = lRSI >= 45 && lRSI <= 55;

  // Candle Math
  const currentSize = lastHigh - lastLow;
  const avgLast10 = history.slice(-10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10;
  
  const hasMomentumCandle = currentSize > (avgLast10 * 1.5);
  const isBullishCandle = lastPrice > lastOpen;
  
  // Traps
  const fakeBreakdown = lastLow < prevLow && isBullishCandle && (lastPrice - lastLow) > (lastHigh - lastPrice);
  const fakeBreakout = lastHigh > prevHigh && !isBullishCandle && (lastHigh - lastOpen) > (lastOpen - lastLow);

  // Breakout / Breakdown
  const volumeIncreases = currentVolume > prevVolume;
  const breakoutDetected = lastPrice > Math.max(prevHigh, prevPrevHigh) && hasMomentumCandle && volumeIncreases && isBullishCandle;
  const breakdownDetected = lastPrice < Math.min(prevLow, prevPrevLow) && hasMomentumCandle && volumeIncreases && !isBullishCandle;
  
  // Higher Highs / Lower Highs
  const higherHighs = lastHigh > prevHigh && prevHigh > prevPrevHigh;
  const lowerHighs = lastHigh < prevHigh && prevHigh < prevPrevHigh;

  let trendStatus = 'NEUTRAL';
  if (!sideways && lastPrice > lVWAP && lEMA9 > lEMA20 && lRSI > 55) trendStatus = 'BULLISH';
  else if (!sideways && lastPrice < lVWAP && lEMA9 < lEMA20 && lRSI < 45) trendStatus = 'BEARISH';

  marketState[instrumentId] = {
    status: trendStatus,
    data: {
      price: lastPrice, vwap: lVWAP, ema9: lEMA9, ema20: lEMA20, rsi: lRSI, macd: lMACD,
      sideways, hasMomentumCandle, isBullishCandle, fakeBreakdown, fakeBreakout,
      breakoutDetected, breakdownDetected, higherHighs, lowerHighs, volumeIncreases, isPrevBullish
    }
  };

  const now = Date.now();
  if (now - lastLogTime > 5000) {
    console.log('\n--- Realtime Market State ---');
    Object.keys(marketState).forEach(id => {
      const d = marketState[id].data;
      if (!d.price) return;
      const oc = optionChainStore[id] || { pcr: 1.0, supportWall: 0, resistanceWall: 0 };
      console.log(`\n${IDS[id]}:`);
      console.log(`Price: ${d.price.toFixed(2)} | VWAP: ${d.vwap ? d.vwap.toFixed(2) : 'N/A'}`);
      console.log(`EMA9:  ${d.ema9 ? d.ema9.toFixed(2) : 'N/A'} | EMA20: ${d.ema20 ? d.ema20.toFixed(2) : 'N/A'}`);
      console.log(`RSI:   ${d.rsi ? d.rsi.toFixed(2) : 'N/A'} | MACD: ${d.macd ? d.macd.toFixed(2) : 'N/A'}`);
      console.log(`PCR:   ${oc.pcr.toFixed(2)} | Support Wall: ${oc.supportWall} | Resistance Wall: ${oc.resistanceWall}`);
    });
    lastLogTime = now;
  }

  checkGlobalScalpSignal(instrumentId, closes, highs, lows);
};

const checkGlobalScalpSignal = async (triggerId, closes, highs, lows) => {
  const bnState = marketState["25"].status;
  const now = Date.now();
  
  const d = marketState[triggerId].data;
  if (!d.price) return;

  const oc = optionChainStore[triggerId] || { pcr: 1.0, supportWall: 0, resistanceWall: 0, signal: 'NEUTRAL' };

  let bScore = 0;
  let sScore = 0;
  const reasonList = [];

  // Option Chain Scoring (CE/PE)
  if (oc.pcr > 1.15) { bScore += 15; reasonList.push(`Bullish Option Chain PCR (${oc.pcr.toFixed(2)})`); }
  else if (oc.pcr > 0.95) { bScore += 10; reasonList.push('Neutral-Bullish PCR'); }
  if (oc.signal === 'BULLISH') { bScore += 10; reasonList.push('Option Chain Trend: BULLISH'); }
  if (oc.supportWall > 0 && d.price >= oc.supportWall) { bScore += 10; reasonList.push('Price Supporting Options Wall'); }

  if (oc.pcr < 0.85) { sScore += 15; reasonList.push(`Bearish Option Chain PCR (${oc.pcr.toFixed(2)})`); }
  else if (oc.pcr < 1.05) { sScore += 10; reasonList.push('Neutral-Bearish PCR'); }
  if (oc.signal === 'BEARISH') { sScore += 10; reasonList.push('Option Chain Trend: BEARISH'); }
  if (oc.resistanceWall > 0 && d.price <= oc.resistanceWall) { sScore += 10; reasonList.push('Price Below Resistance Options Wall'); }

  // BULLISH SCORING
  if (d.price > d.vwap) { bScore += 20; reasonList.push('Price > VWAP'); }
  if (d.ema9 > d.ema20) { bScore += 15; reasonList.push('EMA9 > EMA20'); }
  if (d.rsi > 55) { bScore += 10; reasonList.push('RSI > 55'); }
  if (d.macd > 0) { bScore += 10; reasonList.push('MACD Positive'); }
  if (d.hasMomentumCandle && d.isBullishCandle) { bScore += 20; reasonList.push('Bullish Momentum Candle'); }
  if (d.breakoutDetected) { bScore += 20; reasonList.push('Breakout Detected'); }
  if (d.fakeBreakdown) { bScore += 25; reasonList.push('Fake Breakdown Recovery'); }
  if (d.higherHighs) { bScore += 10; reasonList.push('Higher Highs Forming'); }
  if (bnState === 'BULLISH') { bScore += 10; reasonList.push('BankNifty Bullish'); }
  if (d.isBullishCandle && d.isPrevBullish && d.breakoutDetected) { bScore += 15; reasonList.push('Breakout Sustains'); }
  if (d.volumeIncreases && d.isBullishCandle) { bScore += 10; reasonList.push('Bullish Volume Increase'); }

  // BEARISH SCORING
  if (d.price < d.vwap) { sScore += 20; reasonList.push('Price < VWAP'); }
  if (d.ema9 < d.ema20) { sScore += 15; reasonList.push('EMA9 < EMA20'); }
  if (d.rsi < 45) { sScore += 10; reasonList.push('RSI < 45'); }
  if (d.macd < 0) { sScore += 10; reasonList.push('MACD Negative'); }
  if (d.hasMomentumCandle && !d.isBullishCandle) { sScore += 20; reasonList.push('Bearish Momentum Candle'); }
  if (d.breakdownDetected) { sScore += 20; reasonList.push('Support Breakdown Detected'); }
  if (d.fakeBreakout) { sScore += 25; reasonList.push('Fake Breakout Trap'); }
  if (d.lowerHighs) { sScore += 10; reasonList.push('Lower Highs Forming'); }
  if (bnState === 'BEARISH') { sScore += 10; reasonList.push('BankNifty Weak'); }
  if (!d.isBullishCandle && !d.isPrevBullish && d.breakdownDetected) { sScore += 15; reasonList.push('Breakdown Sustains'); }
  if (d.volumeIncreases && !d.isBullishCandle) { sScore += 10; reasonList.push('Bearish Volume Increase'); }

  const maxScore = Math.max(bScore, sScore);
  const signal = maxScore === bScore && bScore >= 70 ? 'BUY CE' : (maxScore === sScore && sScore >= 70 ? 'BUY PE' : null);

  let stateStr = 'SIDEWAYS';
  if (d.breakoutDetected || d.breakdownDetected) stateStr = 'BREAKOUT / BREAKDOWN';
  else if (d.fakeBreakdown || d.fakeBreakout) stateStr = 'REVERSAL';
  else if (maxScore > 50) stateStr = 'TRENDING';

  // DEBUG LOGGING
  console.log(`[DEBUG ${IDS[triggerId]}] bScore:${bScore} sScore:${sScore} breakout:${d.breakoutDetected} breakdown:${d.breakdownDetected} momentum:${d.hasMomentumCandle} fBreakdown:${d.fakeBreakdown} fBreakout:${d.fakeBreakout} state:${stateStr}`);

  if (maxScore >= 70 && !signal) {
    logger.error(`[CRITICAL] Score ${maxScore} reached but signal prevented by sideways filters!`);
  }

  // Abort if cooling down or sideways
  if (d.sideways || now - lastAlertTime < ALERT_COOLDOWN) return;

  if (signal) {
    lastAlertTime = now;
    const atr = getATR(highs, lows, closes, 14);
    const lATR = atr[atr.length - 1] || (d.price * 0.005);
    const stopLossDist = lATR * 1.5;
    
    const entry = d.price;
    const stopLoss = signal === 'BUY CE' ? entry - stopLossDist : entry + stopLossDist;
    const target1 = signal === 'BUY CE' ? entry + (stopLossDist * 1.5) : entry - (stopLossDist * 1.5);
    const target2 = signal === 'BUY CE' ? entry + (stopLossDist * 3.0) : entry - (stopLossDist * 3.0);

    const msg = `🚨 HIGH PROBABILITY TRADE 🚨

Index: ${IDS[triggerId]}
Signal: ${signal}

Confidence Score: ${maxScore}%

Reason:
${reasonList.map(r => `* ${r}`).join('\n')}

Option Chain Info:
* PCR: ${oc.pcr.toFixed(2)}
* Support Wall: ${oc.supportWall}
* Resistance Wall: ${oc.resistanceWall}

Market State:
${stateStr}

Risk:
${maxScore > 100 ? 'LOW' : 'MEDIUM'}`;

    if (sendAlert) await sendAlert(msg);
  }
};

module.exports = { evaluateMultiIndexStrategy };
