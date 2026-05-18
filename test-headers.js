require('dotenv').config();
const WebSocket = require('ws');

const rawToken = process.env.DHAN_ACCESS_TOKEN.trim();
const rawClient = process.env.DHAN_CLIENT_ID.trim();
const url = `wss://api-feed.dhan.co?version=2&token=${rawToken}&clientId=${rawClient}&authType=2`;

console.log("Connecting...");
const ws = new WebSocket(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Origin': 'https://dhan.co'
  }
});

ws.on('open', () => {
    console.log('✅ Connected');
    // Send minimal valid packet
    ws.send(JSON.stringify({
        RequestCode: 15,
        InstrumentCount: 1,
        InstrumentList: [{ ExchangeSegment: "NSE_EQ", SecurityId: "1333" }]
    }));
});

ws.on('message', (data) => console.log('Message received:', data.length, 'bytes'));
ws.on('close', (code, reason) => { console.log('❌ Closed:', code, reason.toString()); process.exit(0); });
ws.on('error', (err) => console.error('Error:', err));
