require('dotenv').config();
const https = require('https');

const options = {
  hostname: 'api.dhan.co',
  port: 443,
  path: '/fundlimit',
  method: 'GET',
  headers: {
    'access-token': process.env.DHAN_ACCESS_TOKEN.trim(),
    'client-id': process.env.DHAN_CLIENT_ID.trim(),
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('HTTP', res.statusCode, data));
});

req.on('error', console.error);
req.end();
