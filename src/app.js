// Force Node.js to use Indian Standard Time (IST) 
// This overrides the AWS US-East (N. Virginia) server timezone.
process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const { initWebSocket } = require('./websocket/dhanLiveMarket');
const { bot } = require('./telegram/bot');
const app = express();
app.use(express.json());

// --- Simple REST APIs --- //
app.get('/api/health', (req, res) => res.json({ status: 'live', timestamp: Date.now() }));

const bootServer = async () => {
  try {
    logger.info('Initializing Dhan Scalping Engine (Lightweight)...');

    // Start Telegram bot
    if (config.telegram.botToken) {
      bot.launch();
      logger.info('Telegram Bot Online');
    }

    // Connect to Live Market Feed
    if (config.dhan.clientId && config.dhan.accessToken) {
      initWebSocket();
    } else {
      logger.warn('DhanHQ credentials missing. Live Feed unavailable.');
    }

    app.listen(config.port, () => {
      logger.info(`REST API running on port ${config.port}`);
    });
  } catch (err) {
    logger.error(`Boot failure: ${err.message}`);
    process.exit(1);
  }
};

bootServer();

// Graceful Shutdown
process.once('SIGINT', () => {
  if (config.telegram.botToken) bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  if (config.telegram.botToken) bot.stop('SIGTERM');
  process.exit(0);
});
