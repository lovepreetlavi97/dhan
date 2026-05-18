const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
  instrumentId: { type: String, required: true },
  type: { type: String, enum: ['BUY', 'SELL'], required: true },
  price: Number,
  timestamp: { type: Date, default: Date.now },
  confidence: Number,
  entry: Number,
  stopLoss: Number,
  target: Number,
  rrRatio: Number,
  reason: [String],
  indicatorsAtTime: Object
});

module.exports = mongoose.model('Signal', signalSchema);
