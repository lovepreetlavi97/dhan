const logger = require('../utils/logger');
const { evaluateScalpStrategy } = require('../strategies/scalpingStrategy');

// In-memory cache for ultra-fast aggregation
const currentCandles = {};
// Store history up to 100 periods per instrument
const candleHistory = {};

/**
 * Process incoming tick, update current 1m candles in memory.
 */
const processTick = async (tick) => {
  try {
    const { instrumentId, price, volume, oi, timestamp } = tick;
    if (!instrumentId) return;

    // Process 1-minute candle
    const timeKey1m = Math.floor(timestamp / 60000) * 60000;
    const key1m = `1m:${instrumentId}`;
    
    if (!currentCandles[key1m]) {
      // Transition to new candle, push old one to history
      if (currentCandles[`prev_${key1m}`]) {
        if (!candleHistory[instrumentId]) candleHistory[instrumentId] = [];
        candleHistory[instrumentId].push(currentCandles[`prev_${key1m}`]);
        
        // Keep only last 100 candles
        if (candleHistory[instrumentId].length > 100) {
          candleHistory[instrumentId].shift();
        }
      }

      currentCandles[key1m] = {
        open: price, high: price, low: price, close: price, 
        volume: volume, oi: oi || 0, timestamp: timeKey1m
      };
      currentCandles[`prev_${key1m}`] = currentCandles[key1m];
    } else {
      if (price > currentCandles[key1m].high) currentCandles[key1m].high = price;
      if (price < currentCandles[key1m].low) currentCandles[key1m].low = price;
      currentCandles[key1m].close = price;
      currentCandles[key1m].volume += volume;
      currentCandles[key1m].oi = oi || currentCandles[key1m].oi;
    }

    // Trigger strategy evaluation on latest tick
    evaluateScalpStrategy(instrumentId, currentCandles[key1m], candleHistory[instrumentId] || []);

  } catch (error) {
    logger.error(`Error in Candle Engine: ${error.message}`);
  }
};

module.exports = { processTick, candleHistory };
