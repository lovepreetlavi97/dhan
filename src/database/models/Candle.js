const mongoose = require('mongoose');

const candleSchema = new mongoose.Schema({
  instrumentId: { type: String, required: true },
  timeframe: { type: String, required: true }, // e.g., '1m', '3m', '5m'
  timestamp: { type: Date, required: true },
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
  vwap: Number, // Pre-computed VWAP at that tick
  oi: Number    // Open interest at close of candle
});

candleSchema.index({ instrumentId: 1, timeframe: 1, timestamp: -1 });

module.exports = mongoose.model('Candle', candleSchema);
