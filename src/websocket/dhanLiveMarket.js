const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { processTick, preloadHistory } = require('../candles/candleEngine');

let ws = null;
let reconnectWait = 3000;
const COOLDOWN_FILE = path.join(__dirname, '..', '..', '.ws_cooldown');

// Security IDs for Indices
const INSTRUMENTS = [
  { ExchangeSegment: "IDX_I", SecurityId: "13" }, // Nifty 50
  { ExchangeSegment: "IDX_I", SecurityId: "25" }, // Nifty Bank
  { ExchangeSegment: "IDX_I", SecurityId: "51" }  // Sensex
];

const backfillHistoricalData = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    for (const inst of INSTRUMENTS) {
      logger.info(`Fetching historical data for ${inst.SecurityId}...`);
      const response = await fetch('https://api.dhan.co/v2/charts/intraday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': config.dhan.accessToken,
          'client-id': config.dhan.clientId
        },
        body: JSON.stringify({
          securityId: inst.SecurityId,
          exchangeSegment: inst.ExchangeSegment,
          instrument: "INDEX",
          fromDate: today,
          toDate: today
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.open && data.open.length > 0) {
          const history = [];
          for (let i = 0; i < data.open.length; i++) {
            history.push({
              open: data.open[i],
              high: data.high[i],
              low: data.low[i],
              close: data.close[i],
              volume: data.volume[i] || 0,
              timestamp: data.timestamp[i] * 1000,
              oi: 0
            });
          }
          // The candle engine requires 1m, 3m, 5m prefixes for preload
          preloadHistory('1m', inst.SecurityId, history);
        }
      } else {
        logger.warn(`Failed to backfill history for ${inst.SecurityId}: ${response.status}`);
      }
    }
  } catch (error) {
    logger.error(`History backfill error: ${error.message}`);
  }
};

const initWebSocket = async () => {
  if (fs.existsSync(COOLDOWN_FILE)) {
    const lastAttempt = parseInt(fs.readFileSync(COOLDOWN_FILE, 'utf8'), 10);
    const now = Date.now();
    const waitRemaining = (lastAttempt + 30000) - now; 
    
    if (waitRemaining > 0) {
      logger.warn(`Dhan API Rate Limit active. Forced waiting for ${Math.ceil(waitRemaining/1000)}s...`);
      setTimeout(initWebSocket, waitRemaining);
      return;
    }
  }

  // Backfill before connecting
  await backfillHistoricalData();

  fs.writeFileSync(COOLDOWN_FILE, Date.now().toString());

  const rawToken = config.dhan.accessToken ? config.dhan.accessToken.trim() : '';
  const rawClient = config.dhan.clientId ? config.dhan.clientId.trim() : '';
  
  const url = `wss://api-feed.dhan.co?version=2&token=${rawToken}&clientId=${rawClient}&authType=2`;
  
  logger.info(`Connecting to DhanHQ Live Market Feed V2...`);
  ws = new WebSocket(url);

  ws.on('open', () => {
    logger.info('✅ Connected to Dhan WebSocket. Sending JSON Subscription...');
    reconnectWait = 3000; 
    
    ws.send(
      JSON.stringify({
        RequestCode: 15,
        InstrumentCount: INSTRUMENTS.length,
        InstrumentList: INSTRUMENTS
      })
    );
  });

  ws.on('message', (data) => {
    try {
      if (Buffer.isBuffer(data) && data.length >= 16) {
        const responseCode = data.readUInt8(0);
        
        if (responseCode === 2) { // Ticker Data
           const secId = data.readInt32LE(4);
           const ltp = data.readFloatLE(8);
           
           processTick({
              instrumentId: secId.toString(),
              price: ltp,
              volume: 1, 
              oi: 0,
              timestamp: Date.now()
           });
        }
      }
    } catch (err) {}
  });

  ws.on('unexpected-response', (request, response) => {
    if (response.statusCode === 429) {
      reconnectWait = 30000;
      fs.writeFileSync(COOLDOWN_FILE, (Date.now() + 60000).toString());
    }
    request.abort(); 
  });

  ws.on('error', (err) => logger.error(`WebSocket error: ${err.message}`));

  ws.on('close', (code, reason) => {
    logger.warn(`❌ WebSocket Closed. Code: ${code}. Reconnecting in ${reconnectWait/1000}s...`);
    setTimeout(initWebSocket, reconnectWait);
    reconnectWait = Math.min(reconnectWait * 2, 30000); 
  });
};

module.exports = { initWebSocket };
