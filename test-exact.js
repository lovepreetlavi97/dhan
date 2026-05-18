require('dotenv').config();
const WebSocket = require('ws');

// Exact User Snippet
const wsUrl = `wss://api-feed.dhan.co?version=2` +
`&token=${process.env.DHAN_ACCESS_TOKEN}` +
`&clientId=${process.env.DHAN_CLIENT_ID}` +
`&authType=2`;

console.log("Connecting to:", wsUrl.substring(0, 80) + "...");
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ Connected. Sending exact User Payload.');
    ws.send(
      JSON.stringify({
        RequestCode: 15,
        InstrumentCount: 1,
        InstrumentList: [
          {
            ExchangeSegment: "NSE_FNO",
            SecurityId: "49081"
          }
        ]
      })
    );
});

ws.on('message', (data) => console.log('Message:', data));
ws.on('close', (code, reason) => { console.log('❌ Closed:', code); process.exit(); });
ws.on('error', (err) => console.error('Error:', err));
