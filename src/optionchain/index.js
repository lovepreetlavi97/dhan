const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const optionChainStore = {
  "13": { pcr: 1.0, ceOi: 0, peOi: 0, maxPain: 0, supportWall: 0, resistanceWall: 0, signal: 'NEUTRAL' },
  "25": { pcr: 1.0, ceOi: 0, peOi: 0, maxPain: 0, supportWall: 0, resistanceWall: 0, signal: 'NEUTRAL' },
  "51": { pcr: 1.0, ceOi: 0, peOi: 0, maxPain: 0, supportWall: 0, resistanceWall: 0, signal: 'NEUTRAL' }
};

const fetchExpiryList = async (scripId, segment) => {
  try {
    const url = 'https://api.dhan.co/v2/optionchain/expirylist';
    const response = await axios.post(url, {
      UnderlyingScrip: parseInt(scripId, 10),
      UnderlyingSeg: segment
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access-token': config.dhan.accessToken,
        'client-id': config.dhan.clientId
      }
    });
    return response.data.data || null;
  } catch (err) {
    logger.error(`Error fetching expiry list for ${scripId}: ${err.message}`);
    return null;
  }
};

const fetchOptionChainData = async (scripId, segment, expiry) => {
  try {
    const url = 'https://api.dhan.co/v2/optionchain';
    const response = await axios.post(url, {
      UnderlyingScrip: parseInt(scripId, 10),
      UnderlyingSeg: segment,
      Expiry: expiry
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access-token': config.dhan.accessToken,
        'client-id': config.dhan.clientId
      }
    });
    return response.data.data || null;
  } catch (err) {
    logger.error(`Error fetching option chain for ${scripId}: ${err.message}`);
    return null;
  }
};

const processOptionChain = async (scripId, segment) => {
  const expiries = await fetchExpiryList(scripId, segment);
  if (!expiries || expiries.length === 0) return;
  const expiry = expiries[0]; // Nearest expiry

  const data = await fetchOptionChainData(scripId, segment, expiry);
  if (!data || !data.oc) return;

  let totalCeOi = 0;
  let totalPeOi = 0;
  let maxCeOi = 0;
  let maxPeOi = 0;
  let resistanceWall = 0;
  let supportWall = 0;

  Object.entries(data.oc).forEach(([strikeStr, val]) => {
    const strike = parseFloat(strikeStr);
    if (val.ce) {
      totalCeOi += val.ce.oi || 0;
      if ((val.ce.oi || 0) > maxCeOi) {
        maxCeOi = val.ce.oi;
        resistanceWall = strike;
      }
    }
    if (val.pe) {
      totalPeOi += val.pe.oi || 0;
      if ((val.pe.oi || 0) > maxPeOi) {
        maxPeOi = val.pe.oi;
        supportWall = strike;
      }
    }
  });

  const pcr = totalCeOi > 0 ? totalPeOi / totalCeOi : 1.0;
  let signal = 'NEUTRAL';
  if (pcr > 1.2) signal = 'BULLISH';
  else if (pcr < 0.7) signal = 'BEARISH';

  optionChainStore[scripId] = {
    pcr,
    ceOi: totalCeOi,
    peOi: totalPeOi,
    resistanceWall,
    supportWall,
    signal
  };

  logger.info(`Processed Option Chain for Scrip ${scripId}: PCR=${pcr.toFixed(2)}, Support=${supportWall}, Resistance=${resistanceWall}`);
};

const startOptionChainSync = () => {
  const runSync = async () => {
    // Stagger calls by 3 seconds to avoid rate limits (1 req per 3s limit)
    try {
      await processOptionChain("13", "IDX_I");
      await new Promise(r => setTimeout(r, 3100));
      await processOptionChain("25", "IDX_I");
      await new Promise(r => setTimeout(r, 3100));
      await processOptionChain("51", "IDX_I");
    } catch (err) {
      logger.error(`Error in Option Chain Sync Loop: ${err.message}`);
    }
  };

  runSync();
  setInterval(runSync, 60000); // Repeat every 60 seconds
};

module.exports = { optionChainStore, startOptionChainSync };
