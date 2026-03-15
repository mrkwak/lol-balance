// POST /api/search → Riot API로 소환사 검색
const { getRoom, setRoom } = require('../lib/store');
const { fetchPlayerData, parseRiotApiError } = require('../lib/riot');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { roomCode, riotIds } = req.body;
    if (!roomCode || !riotIds || !Array.isArray(riotIds)) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Riot API 키가 설정되지 않았습니다.' });
    }
    console.log('RIOT_API_KEY loaded:', apiKey.substring(0, 10) + '...');

    const room = await getRoom(roomCode);
    if (!room) return res.status(404).json({ error: '존재하지 않는 방입니다.' });

    const players = [];
    const errors = [];

    // 배치 처리 (3명씩, 서버리스 타임아웃 방지)
    const filtered = riotIds.map(id => id.trim()).filter(Boolean);
    for (let i = 0; i < filtered.length; i += 3) {
      const batch = filtered.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(rid => fetchPlayerData(rid))
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          players.push(r.value);
        } else {
          errors.push({
            riotId: batch[j],
            error: parseRiotApiError(r.reason),
          });
        }
      }

      // 배치 간 딜레이 (Rate limit 방지)
      if (i + 3 < filtered.length) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    room.players = players;
    room.teams = null;
    room.alternatives = null;
    room.altIndex = 0;
    room.version++;
    await setRoom(roomCode, room);

    return res.json({ players, errors });
  } catch (err) {
    console.error('search error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
