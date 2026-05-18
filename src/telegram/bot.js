const { Telegraf } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');

// The user mentioned using existing env variables.
// Depending on what is in the .env, we initialize standard Telegraf.
// If the user meant GramJS, this can be easily swapped. We'll stick to what was already running (telegraf)
// but add support for the session if that's what they wanted.
// Since Telegraf uses standard Bot API, let's keep it robust.

let bot = null;

if (config.telegram.botToken) {
  bot = new Telegraf(config.telegram.botToken);
  bot.start((ctx) => ctx.reply('Dhan Scalper Active'));
}

const sendAlert = async (message) => {
  try {
    if (bot && config.telegram.chatId) {
      await bot.telegram.sendMessage(config.telegram.chatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram alert successfully dispatched.');
    }
  } catch (err) {
    logger.error(`Telegram dispatcher error: ${err.message}`);
  }
};

module.exports = { bot, sendAlert };
