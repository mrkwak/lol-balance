// POST /api/teams → 팀 밸런싱 / 랜덤 / 다른 조합 / 롤링(다음 판)
const { getRoom, setRoom } = require('../lib/store');
const { balanceTeams, rollingBalance, randomTeams } = require('../lib/balance');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { roomCode, action } = req.body;
    if (!roomCode || !action) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const room = await getRoom(roomCode);
    if (!room) return res.status(404).json({ error: '존재하지 않는 방입니다.' });

    if (room.players.length < 2) {
      return res.status(400).json({ error: '최소 2명 이상의 플레이어가 필요합니다.' });
    }

    // 라운드 기록 초기화
    if (!room.rounds) room.rounds = [];

    let result;

    if (action === 'balance') {
      const balanced = balanceTeams(room.players);
      room.teams = balanced.current;
      room.alternatives = balanced.alternatives;
      room.altIndex = 0;
      result = balanced.current;

    } else if (action === 'rolling') {
      // 현재 팀을 라운드 기록에 저장 후 새로운 밸런스 구성
      if (room.teams && room.teams.team1Indices) {
        room.rounds.push(room.teams.team1Indices);
      }
      const balanced = rollingBalance(room.players, room.rounds);
      room.teams = balanced.current;
      room.alternatives = balanced.alternatives;
      room.altIndex = 0;
      result = { ...balanced.current, round: room.rounds.length + 1 };

    } else if (action === 'reset-rounds') {
      // 라운드 기록 초기화
      room.rounds = [];
      const balanced = balanceTeams(room.players);
      room.teams = balanced.current;
      room.alternatives = balanced.alternatives;
      room.altIndex = 0;
      result = { ...balanced.current, round: 1 };

    } else if (action === 'random') {
      result = randomTeams(room.players);
      room.teams = result;
      room.alternatives = null;
      room.altIndex = 0;

    } else if (action === 'next-alt') {
      if (!room.alternatives || room.alternatives.length === 0) {
        return res.status(400).json({ error: '먼저 밸런스 나누기를 실행하세요.' });
      }
      room.altIndex = (room.altIndex + 1) % room.alternatives.length;
      result = room.alternatives[room.altIndex];
      room.teams = result;
      result = { ...result, index: room.altIndex, total: room.alternatives.length };

    } else {
      return res.status(400).json({ error: '알 수 없는 액션입니다.' });
    }

    // 현재 라운드 수 포함
    result.roundCount = (room.rounds || []).length;

    room.version++;
    await setRoom(roomCode, room);
    return res.json(result);
  } catch (err) {
    console.error('teams error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
