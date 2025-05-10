// scripts/wait-for-redis.js
import { createClient } from 'redis';

const client = createClient();

client.on('error', () => {}); // suppress error logs

const maxTries = 10;
let tries = 0;

async function waitForRedis() {
  while (tries < maxTries) {
    try {
      await client.connect();
      await client.ping();
      await client.disconnect();
      console.log('✅ Redis is ready');
      process.exit(0);
    } catch (err) {
      tries++;
      console.log(`⏳ Waiting for Redis... (${tries})`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
  console.error('❌ Redis not available after 10 tries');
  process.exit(1);
}

waitForRedis();
