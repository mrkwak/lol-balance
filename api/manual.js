// POST /api/manual → 수동 플레이어 입력
const { getRoom, setRoom } = require('../lib/store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { roomCode, players } = req.body;
    if (!roomCode || !players || !Array.isArray(players)) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const room = await getRoom(roomCode);
    if (!room) return res.status(404).json({ error: '존재하지 않는 방입니다.' });

    room.players = players;
    room.teams = null;
    room.alternatives = null;
    room.altIndex = 0;
    room.version++;
    await setRoom(roomCode, room);

    return res.json({ players });
  } catch (err) {
    console.error('manual error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
