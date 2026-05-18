require('dotenv').config();
const WebSocket = require('ws');
const { DhanFeed } = require('dhanhq');

const rawToken = process.env.DHAN_ACCESS_TOKEN.trim();
const rawClient = process.env.DHAN_CLIENT_ID.trim();

// 1. Build URL
const url = `wss://api-feed.dhan.co?version=2&token=${rawToken}&clientId=${rawClient}&authType=2`;

// 2. Hijack DhanFeed to build binary packet
const feed = new DhanFeed(rawClient, rawToken, [], 15);
const subscriptionPacket = feed.createSubscriptionPacket([[2, "49081"]], 15, true); // 2 = NSE_FNO

console.log("Connecting to V2 URL and sending Binary Packet...");
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('✅ Connected');
    ws.send(subscriptionPacket);
    console.log('Sent Binary Packet!');
});

ws.on('message', (data) => console.log('Message received:', data.length, 'bytes'));
ws.on('close', (code, reason) => { console.log('❌ Closed:', code, reason.toString()); process.exit(0); });
ws.on('error', (err) => console.error('Error:', err));
