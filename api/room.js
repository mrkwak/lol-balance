// GET /api/room?code=XXXX  → 방 상태 폴링
// POST /api/room           → 방 생성
const { getRoom, setRoom, generateRoomCode, createRoomData } = require('../lib/store');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      // 방 생성
      let code = generateRoomCode();
      let attempts = 0;
      while (await getRoom(code) && attempts < 10) {
        code = generateRoomCode();
        attempts++;
      }

      const room = createRoomData();
      await setRoom(code, room);
      return res.json({ code, version: room.version });
    }

    if (req.method === 'GET') {
      // 방 상태 폴링
      const code = (req.query.code || '').toUpperCase().trim();
      if (!code) return res.status(400).json({ error: '방 코드가 필요합니다.' });

      const room = await getRoom(code);
      if (!room) return res.status(404).json({ error: '존재하지 않는 방입니다.' });

      // 클라이언트가 보낸 버전과 같으면 변경 없음
      const clientVersion = parseInt(req.query.v) || 0;
      if (clientVersion === room.version) {
        return res.json({ changed: false, version: room.version });
      }

      return res.json({
        changed: true,
        version: room.version,
        players: room.players,
        teams: room.teams,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('room error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
