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

    // Schedule 6:00 AM IST Daily System Check
    setInterval(async () => {
      const now = new Date();
      
      // Runs at exactly 6:00 AM IST or 12:28 AM IST
      const is6AM = now.getHours() === 6 && now.getMinutes() === 0;
      const is1228AM = now.getHours() === 0 && now.getMinutes() === 28;

      if (is6AM || is1228AM) {
        try {
          const { sendAlert } = require('./telegram/bot');
          const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
          await sendAlert(`🌅 <b>System Heartbeat</b>\n\nGood morning! Dhan Scalper Pro is currently online and fully stable on the AWS server.\n\nServer Time: ${timeStr}\n\nStanding by for Market Open!`);
          logger.info(`Dispatched Status Alert at ${timeStr}`);
        } catch (err) {
          logger.error('Failed to send daily alert: ' + err.message);
        }
      }
    }, 60000); // Check every 60 seconds

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
