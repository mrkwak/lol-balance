// 팀 밸런싱 알고리즘 (완전탐색 + 롤링 다양성)

// 모든 조합 생성 유틸
function generateCombinations(n, k) {
  const results = [];
  function combine(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return results;
}

// 기본 밸런스 팀 나누기
function balanceTeams(players) {
  const n = players.length;
  if (n < 2) return null;

  const teamSize = Math.floor(n / 2);
  const scores = players.map(p => p.score);
  const total = scores.reduce((a, b) => a + b, 0);
  const indices = Array.from({ length: n }, (_, i) => i);

  const combos = generateCombinations(n, teamSize);
  const allResults = combos.map(combo => {
    const sum1 = combo.reduce((s, i) => s + scores[i], 0);
    return { combo, diff: Math.abs(sum1 - (total - sum1)), sum1, sum2: total - sum1 };
  });

  allResults.sort((a, b) => a.diff - b.diff);

  const alternatives = allResults.slice(0, 5).map(r => formatResult(r, players, indices));
  return { current: alternatives[0], alternatives };
}

// 롤링 밸런스: 이전 라운드와 다른 팀 구성 우선
function rollingBalance(players, previousRounds = []) {
  if (previousRounds.length === 0) return balanceTeams(players);

  const n = players.length;
  if (n < 2) return null;

  const teamSize = Math.floor(n / 2);
  const scores = players.map(p => p.score);
  const total = scores.reduce((a, b) => a + b, 0);
  const indices = Array.from({ length: n }, (_, i) => i);

  const combos = generateCombinations(n, teamSize);

  const evaluated = combos.map(combo => {
    const sum1 = combo.reduce((s, i) => s + scores[i], 0);
    const diff = Math.abs(sum1 - (total - sum1));
    const comboSet = new Set(combo);

    // 이전 라운드 대비 다양성 점수 (높을수록 더 많이 섞임)
    let diversity = 0;
    for (const prevIndices of previousRounds) {
      const prevSet = new Set(prevIndices);
      let switches = 0;
      for (let i = 0; i < n; i++) {
        if (prevSet.has(i) !== comboSet.has(i)) switches++;
      }
      diversity += switches;
    }
    diversity /= previousRounds.length;

    return { combo, diff, sum1, sum2: total - sum1, diversity };
  });

  // 최적 밸런스 차이 찾기
  const minDiff = Math.min(...evaluated.map(e => e.diff));

  // 밸런스 차이가 최적+2점 이내인 조합만 필터
  const threshold = minDiff + 2;
  const viable = evaluated.filter(e => e.diff <= threshold);

  // 다양성 높은 순으로 정렬
  viable.sort((a, b) => b.diversity - a.diversity);

  const alternatives = viable.slice(0, 5).map(r => {
    const result = formatResult(r, players, indices);
    result.diversity = Math.round(r.diversity * 10) / 10;
    return result;
  });

  return { current: alternatives[0], alternatives };
}

function randomTeams(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const mid = Math.floor(shuffled.length / 2);
  const team1 = shuffled.slice(0, mid);
  const team2 = shuffled.slice(mid);
  const team1Score = Math.round(team1.reduce((s, p) => s + p.score, 0) * 10) / 10;
  const team2Score = Math.round(team2.reduce((s, p) => s + p.score, 0) * 10) / 10;

  return {
    team1, team2, team1Score, team2Score,
    diff: Math.round(Math.abs(team1Score - team2Score) * 10) / 10,
    isRandom: true,
  };
}

function formatResult(r, players, indices) {
  const team2Indices = indices.filter(i => !r.combo.includes(i));
  return {
    team1: r.combo.map(i => players[i]),
    team2: team2Indices.map(i => players[i]),
    team1Score: Math.round(r.sum1 * 10) / 10,
    team2Score: Math.round(r.sum2 * 10) / 10,
    diff: Math.round(r.diff * 10) / 10,
    team1Indices: r.combo,
  };
}

module.exports = { balanceTeams, rollingBalance, randomTeams };
