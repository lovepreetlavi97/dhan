require('dotenv').config();
const { DhanFeed, NSE_FNO } = require('dhanhq');

const clientId = process.env.DHAN_CLIENT_ID.trim();
const accessToken = process.env.DHAN_ACCESS_TOKEN.trim();

const feed = new DhanFeed(
  clientId,
  accessToken,
  [[NSE_FNO, "49081"]],
  15,
  async (client) => { console.log('✅ Auth success!'); client.subscribe(15, [[NSE_FNO, "49081"]]); },
  async (client, response) => { console.log('Message:', response); },
  async (client, status, msg) => { console.log('❌ Closed:', status, msg); process.exit(); }
);

feed.connect().catch(e => console.error(e));
