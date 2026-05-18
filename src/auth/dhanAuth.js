const config = require('../config');

// Dhan Authentication headers helper
const getAuthHeaders = () => {
  return {
    'access-token': config.dhan.accessToken,
    'client-id': config.dhan.clientId,
    'Content-Type': 'application/json'
  };
};

module.exports = { getAuthHeaders };
