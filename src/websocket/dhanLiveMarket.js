const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { processTick } = require('../candles/candleEngine');

let ws = null;
let reconnectWait = 3000;
const COOLDOWN_FILE = path.join(__dirname, '..', '..', '.ws_cooldown');

const initWebSocket = () => {
  // Enforce persistent cooldown across nodemon restarts
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

  // Update cooldown file
  fs.writeFileSync(COOLDOWN_FILE, Date.now().toString());

  const rawToken = config.dhan.accessToken ? config.dhan.accessToken.trim() : '';
  const rawClient = config.dhan.clientId ? config.dhan.clientId.trim() : '';
  
  // Official Dhan V2 connection URL
  const url = `wss://api-feed.dhan.co?version=2&token=${rawToken}&clientId=${rawClient}&authType=2`;
  
  logger.info(`Connecting to DhanHQ Live Market Feed V2...`);
  ws = new WebSocket(url);

  ws.on('open', () => {
    logger.info('✅ Connected to Dhan WebSocket. Sending JSON Subscription...');
    reconnectWait = 3000; // Reset wait on success
    
    // Dhan V2 uses JSON for requests, but Binary for responses
    ws.send(
      JSON.stringify({
        RequestCode: 15,
        InstrumentCount: 1,
        InstrumentList: [
          {
            ExchangeSegment: "NSE_FNO",
            SecurityId: "49081"
          }
        ]
      })
    );
    logger.info('JSON Subscription request sent.');
  });

  ws.on('message', (data) => {
    try {
      // Market Feed Responses in V2 are always Binary (Little Endian)
      if (Buffer.isBuffer(data) && data.length >= 13) {
        const responseCode = data.readUInt8(2);
        if (responseCode === 2) { // Ticker Data
           const secId = data.readInt32LE(5);
           const ltp = data.readFloatLE(9);
           
           processTick({
              instrumentId: secId.toString(),
              price: ltp,
              volume: 1, 
              oi: 0,
              timestamp: Date.now()
           });
        }
      }
    } catch (err) {
      // Ignore binary parsing errors
    }
  });

  ws.on('unexpected-response', (request, response) => {
    logger.error(`WebSocket rejected. HTTP Status: ${response.statusCode}`);
    if (response.statusCode === 429) {
      reconnectWait = 30000;
      fs.writeFileSync(COOLDOWN_FILE, (Date.now() + 60000).toString());
    }
    request.abort(); 
  });

  ws.on('error', (err) => logger.error(`WebSocket error: ${err.message}`));

  ws.on('close', (code, reason) => {
    logger.warn(`❌ WebSocket Closed. Code: ${code}, Reason: ${reason ? reason.toString() : 'None'}. Reconnecting in ${reconnectWait/1000}s...`);
    setTimeout(initWebSocket, reconnectWait);
    reconnectWait = Math.min(reconnectWait * 2, 30000); 
  });
};

module.exports = { initWebSocket };
