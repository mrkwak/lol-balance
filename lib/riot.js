// Riot Games API 연동
const axios = require('axios');

const REGION = 'asia';
const PLATFORM = 'kr';

function getApiClient() {
  return axios.create({
    headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
    timeout: 8000,
  });
}

const TIER_BASE = {
  IRON: 0, BRONZE: 4, SILVER: 8, GOLD: 12,
  PLATINUM: 16, EMERALD: 20, DIAMOND: 24,
  MASTER: 28, GRANDMASTER: 30, CHALLENGER: 32,
};
const DIV_SCORE = { IV: 0, III: 1, II: 2, I: 3 };
const TIER_KR = {
  IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드',
  PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아몬드',
  MASTER: '마스터', GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저',
};

// 향상된 점수 계산: 랭크 + LP 세분화 + 승률 보정
function calculateScore(tier, division, lp = 0, wins = 0, losses = 0) {
  // 1) 기본 랭크 점수 (0~34)
  let base = 10; // 언랭 기본값
  if (tier) {
    base = TIER_BASE[tier] ?? 10;
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) {
      base += Math.floor(lp / 100);
    } else {
      base += (DIV_SCORE[division] ?? 0);
      // LP로 디비전 내 세분화 (0~0.99)
      base += lp / 100;
    }
  }

  // 2) 승률 보정 (최소 15판 이상일 때)
  const totalGames = wins + losses;
  let wrMod = 0;
  if (totalGames >= 15) {
    const wr = wins / totalGames;
    // 50% 기준, 승률 1%당 ±0.1점, 최대 ±3점
    wrMod = Math.max(-3, Math.min(3, (wr - 0.50) * 10));
  }

  return Math.round((base + wrMod) * 10) / 10;
}

// 하위 호환용
function rankToScore(tier, division, lp = 0) {
  return calculateScore(tier, division, lp);
}

async function fetchPlayerData(riotId) {
  const api = getApiClient();
  const hashIdx = riotId.lastIndexOf('#');
  if (hashIdx === -1) throw new Error('형식 오류: 이름#태그');

  const gameName = riotId.substring(0, hashIdx).trim();
  const tagLine = riotId.substring(hashIdx + 1).trim();
  if (!gameName || !tagLine) throw new Error('형식 오류: 이름#태그');

  const accountUrl = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { data: account } = await api.get(accountUrl);

  const summonerUrl = `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`;
  const { data: summoner } = await api.get(summonerUrl);

  const leagueUrl = `https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`;
  const { data: leagues } = await api.get(leagueUrl);
  const solo = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');

  let tier = null, division = null, lp = 0, wins = 0, losses = 0;
  if (solo) {
    tier = solo.tier;
    division = solo.rank;
    lp = solo.leaguePoints;
    wins = solo.wins;
    losses = solo.losses;
  }

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    riotId: `${account.gameName}#${account.tagLine}`,
    level: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    tier, division, lp, wins, losses,
    winRate: (wins + losses) > 0 ? Math.round(wins / (wins + losses) * 100) : 0,
    score: calculateScore(tier, division, lp, wins, losses),
    tierKr: tier ? TIER_KR[tier] : '언랭',
  };
}

function parseRiotApiError(err) {
  const status = err.response?.status;
  if (status === 404) return '소환사를 찾을 수 없습니다';
  if (status === 401 || status === 403) return 'API 키가 유효하지 않습니다';
  if (status === 429) return 'API 요청 제한 초과 (잠시 후 재시도)';
  return err.message || '알 수 없는 오류';
}

module.exports = { fetchPlayerData, parseRiotApiError, calculateScore, rankToScore, TIER_BASE, DIV_SCORE, TIER_KR };
