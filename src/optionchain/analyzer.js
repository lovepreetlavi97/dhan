const logger = require('../utils/logger');

/**
 * Analyzes real-time OI changes to detect Put/Call writing
 */
const analyzeOI = (ceData, peData) => {
  // Simplified logic for representation
  const callWriting = ceData.oiChange > 0 && ceData.priceChange < 0;
  const putWriting = peData.oiChange > 0 && peData.priceChange < 0;
  const shortCoveringCE = ceData.oiChange < 0 && ceData.priceChange > 0;
  const shortCoveringPE = peData.oiChange < 0 && peData.priceChange > 0;

  let bias = 'NEUTRAL';
  let strength = 0;

  if (putWriting || shortCoveringCE) {
    bias = 'BULLISH';
    strength += putWriting ? 20 : 10;
  }
  
  if (callWriting || shortCoveringPE) {
    bias = 'BEARISH';
    strength += callWriting ? 20 : 10;
  }

  return {
    bias,
    strength, // 0 to 100
    putWriting,
    callWriting,
    pcr: peData.totalOi / (ceData.totalOi || 1)
  };
};

module.exports = { analyzeOI };
