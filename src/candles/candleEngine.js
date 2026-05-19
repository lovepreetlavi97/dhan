const logger = require('../utils/logger');
const { evaluateMultiIndexStrategy } = require('../strategies/scalpingStrategy');

// In-memory cache for ultra-fast aggregation
const currentCandles = { '1m': {}, '3m': {}, '5m': {} };
// Store history up to 100 periods per instrument
const candleHistory = { '1m': {}, '3m': {}, '5m': {} };

const getBucketTime = (timestamp, minutes) => {
  return Math.floor(timestamp / (minutes * 60000)) * (minutes * 60000);
};

const processTick = (tick) => {
  try {
    const { instrumentId, price, volume, oi, timestamp } = tick;
    if (!instrumentId || price <= 0) return;

    const timeframes = [1, 3, 5];
    
    timeframes.forEach(tf => {
      const tfKey = `${tf}m`;
      const bucketTime = getBucketTime(timestamp, tf);
      const key = `${tfKey}:${instrumentId}`;
      
      if (!currentCandles[tfKey][key] || currentCandles[tfKey][key].timestamp !== bucketTime) {
        // Transition to new candle, push old one to history
        if (currentCandles[tfKey][key]) {
          if (!candleHistory[tfKey][instrumentId]) candleHistory[tfKey][instrumentId] = [];
          candleHistory[tfKey][instrumentId].push(currentCandles[tfKey][key]);
          
          if (candleHistory[tfKey][instrumentId].length > 100) {
            candleHistory[tfKey][instrumentId].shift();
          }
        }

        currentCandles[tfKey][key] = {
          open: price, high: price, low: price, close: price, 
          volume: volume || 0, oi: oi || 0, timestamp: bucketTime
        };
      } else {
        if (price > currentCandles[tfKey][key].high) currentCandles[tfKey][key].high = price;
        if (price < currentCandles[tfKey][key].low) currentCandles[tfKey][key].low = price;
        currentCandles[tfKey][key].close = price;
        currentCandles[tfKey][key].volume += (volume || 0);
        currentCandles[tfKey][key].oi = oi || currentCandles[tfKey][key].oi;
      }
    });

    const c1m = currentCandles['1m'][`1m:${instrumentId}`];
    const h1m = candleHistory['1m'][instrumentId] || [];
    
    // Trigger strategy evaluation on latest tick
    evaluateMultiIndexStrategy(instrumentId, c1m, h1m);

  } catch (error) {
    logger.error(`Error in Candle Engine: ${error.message}`);
  }
};

const preloadHistory = (tfKey, instrumentId, historyData) => {
  if (!candleHistory[tfKey][instrumentId]) candleHistory[tfKey][instrumentId] = [];
  candleHistory[tfKey][instrumentId] = historyData;
  logger.info(`Preloaded ${historyData.length} ${tfKey} candles for ${instrumentId}`);
};

module.exports = { processTick, candleHistory, currentCandles, preloadHistory };
