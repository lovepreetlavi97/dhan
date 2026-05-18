require('dotenv').config();
const WebSocket = require('ws');

const url = `wss://api-feed.dhan.co?version=2&token=${process.env.DHAN_ACCESS_TOKEN}&clientId=${process.env.DHAN_CLIENT_ID}&authType=0`;

const ws = new WebSocket(url);
ws.on('open', () => console.log('Connected!'));
ws.on('close', (c,r) => console.log('Closed', c, r.toString()));
