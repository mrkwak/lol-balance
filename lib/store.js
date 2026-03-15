// 저장소 추상화: Upstash Redis (Vercel) 또는 인메모리 (로컬 개발)
let redis = null;
const memoryStore = new Map();

function getRedis() {
  if (redis) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }
  return null;
}

const ROOM_TTL = 10800; // 3시간

async function getRoom(code) {
  const r = getRedis();
  if (r) {
    const data = await r.get(`room:${code}`);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  const room = memoryStore.get(code);
  if (room && Date.now() - room.createdAt > ROOM_TTL * 1000) {
    memoryStore.delete(code);
    return null;
  }
  return room || null;
}

async function setRoom(code, data) {
  const r = getRedis();
  if (r) {
    await r.set(`room:${code}`, JSON.stringify(data), { ex: ROOM_TTL });
  } else {
    memoryStore.set(code, data);
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoomData() {
  return {
    players: [],
    teams: null,
    alternatives: null,
    altIndex: 0,
    version: 0,
    createdAt: Date.now(),
  };
}

module.exports = { getRoom, setRoom, generateRoomCode, createRoomData };
