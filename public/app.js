// ── 상태 ──
let roomCode = null;
let currentPlayers = [];
let currentTeams = null;
let knownVersion = 0;
let pollTimer = null;

// ── DOM ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── API 호출 ──
async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  if (code) joinRoom(code);
});

function initUI() {
  $('#btn-create').addEventListener('click', createRoom);
  $('#btn-join').addEventListener('click', () => {
    const code = $('#input-room-code').value.trim();
    if (code) joinRoom(code);
  });
  $('#input-room-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) joinRoom(code);
    }
  });

  $('#btn-copy-code').addEventListener('click', () => {
    const url = `${location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => showToast('링크가 복사되었습니다'));
  });

  // 입력 모드 토글
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.input-mode').forEach(m => m.classList.remove('active'));
      $(`#mode-${btn.dataset.mode}`).classList.add('active');
      $('#btn-search').style.display = btn.dataset.mode === 'manual' ? 'none' : '';
    });
  });

  // 개별 입력 필드 (10개)
  const playerInputs = $('#player-inputs');
  for (let i = 1; i <= 10; i++) {
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<span class="num">${i}</span><input type="text" class="input player-rid" placeholder="소환사명#태그" data-index="${i}">`;
    playerInputs.appendChild(row);
  }

  // 수동 입력 필드 (10개)
  const manualInputs = $('#manual-inputs');
  const tiers = ['언랭', '아이언', '브론즈', '실버', '골드', '플래티넘', '에메랄드', '다이아몬드', '마스터', '그랜드마스터', '챌린저'];
  const tierValues = ['', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
  const divs = ['IV', 'III', 'II', 'I'];

  for (let i = 1; i <= 10; i++) {
    const row = document.createElement('div');
    row.className = 'manual-row';
    row.innerHTML = `
      <span class="num">${i}</span>
      <input type="text" class="input manual-name" placeholder="닉네임" data-index="${i}">
      <select class="manual-tier" data-index="${i}">
        ${tiers.map((t, j) => `<option value="${tierValues[j]}">${t}</option>`).join('')}
      </select>
      <select class="manual-div" data-index="${i}">
        ${divs.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    `;
    manualInputs.appendChild(row);
  }

  $('#btn-search').addEventListener('click', searchPlayers);
  $('#btn-manual-apply').addEventListener('click', applyManualPlayers);
  $('#btn-balance').addEventListener('click', () => teamAction('balance'));
  $('#btn-random').addEventListener('click', () => teamAction('random'));
  $('#btn-alt').addEventListener('click', () => teamAction('next-alt'));
  $('#btn-copy-teams').addEventListener('click', copyTeams);
  $('#btn-next-round').addEventListener('click', () => teamAction('rolling'));
  $('#btn-reset-rounds').addEventListener('click', () => teamAction('reset-rounds'));
}

// ── 폴링 (3초마다 방 상태 동기화) ──
function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollRoom, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollRoom() {
  if (!roomCode) return;
  try {
    const data = await api(`room?code=${roomCode}&v=${knownVersion}`);
    if (data.changed) {
      knownVersion = data.version;
      if (data.players) {
        currentPlayers = data.players;
        renderPlayers(data.players);
      }
      if (data.teams) {
        currentTeams = data.teams;
        renderTeams(data.teams);
      } else if (data.teams === null && currentTeams !== null) {
        currentTeams = null;
        $('#teams-section').classList.add('hidden');
      }
    }
  } catch {
    // 폴링 실패 무시
  }
}

// ── 방 관리 ──
async function createRoom() {
  try {
    const data = await api('room', { method: 'POST' });
    roomCode = data.code;
    knownVersion = data.version;
    enterMainScreen();
    startPolling();
  } catch (err) {
    showToast(err.message);
  }
}

async function joinRoom(code) {
  try {
    const data = await api(`room?code=${code.toUpperCase().trim()}`);
    roomCode = code.toUpperCase().trim();
    knownVersion = data.version;
    enterMainScreen();

    if (data.players && data.players.length > 0) {
      currentPlayers = data.players;
      renderPlayers(data.players);
    }
    if (data.teams) {
      currentTeams = data.teams;
      renderTeams(data.teams);
    }
    startPolling();
  } catch (err) {
    showToast(err.message);
  }
}

function enterMainScreen() {
  $('#room-screen').classList.remove('active');
  $('#main-screen').classList.add('active');
  $('#display-room-code').textContent = roomCode;
  history.replaceState(null, '', `?room=${roomCode}`);
}

// ── 소환사 검색 ──
async function searchPlayers() {
  const activeMode = $('.toggle-btn.active').dataset.mode;
  let riotIds = [];

  if (activeMode === 'individual') {
    riotIds = Array.from($$('.player-rid')).map(i => i.value.trim()).filter(Boolean);
  } else if (activeMode === 'bulk') {
    riotIds = $('#bulk-textarea').value.split('\n').map(l => l.trim()).filter(Boolean);
  }

  if (riotIds.length === 0) return showToast('소환사명을 입력하세요');

  const invalid = riotIds.filter(id => !id.includes('#'));
  if (invalid.length > 0) return showToast(`형식 오류: ${invalid[0]} (이름#태그 형식으로 입력)`);

  showProgress();
  $('#btn-search').disabled = true;

  try {
    const data = await api('search', {
      method: 'POST',
      body: JSON.stringify({ roomCode, riotIds }),
    });
    currentPlayers = data.players;
    knownVersion++;
    renderPlayers(data.players);
    renderErrors(data.errors);
  } catch (err) {
    showToast(err.message);
  } finally {
    hideProgress();
    $('#btn-search').disabled = false;
  }
}

// ── 수동 플레이어 ──
async function applyManualPlayers() {
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

  const players = [];
  for (let i = 1; i <= 10; i++) {
    const name = $(`.manual-name[data-index="${i}"]`).value.trim();
    if (!name) continue;
    const tier = $(`.manual-tier[data-index="${i}"]`).value || null;
    const div = $(`.manual-div[data-index="${i}"]`).value;
    let score = 10;
    if (tier) {
      const base = TIER_BASE[tier] ?? 10;
      score = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? base : base + (DIV_SCORE[div] ?? 0);
    }
    players.push({
      gameName: name, tagLine: '', riotId: name, level: 0,
      tier, division: div, lp: 0, wins: 0, losses: 0, winRate: 0,
      score, tierKr: tier ? TIER_KR[tier] : '언랭',
    });
  }

  if (players.length < 2) return showToast('최소 2명 이상 입력하세요');

  try {
    await api('manual', { method: 'POST', body: JSON.stringify({ roomCode, players }) });
    currentPlayers = players;
    knownVersion++;
    renderPlayers(players);
  } catch (err) {
    showToast(err.message);
  }
}

// ── 팀 액션 ──
async function teamAction(action) {
  if (currentPlayers.length < 2) return showToast('최소 2명 이상의 플레이어가 필요합니다');
  try {
    const result = await api('teams', { method: 'POST', body: JSON.stringify({ roomCode, action }) });
    currentTeams = result;
    knownVersion++;
    renderTeams(result);
  } catch (err) {
    showToast(err.message);
  }
}

// ── 렌더링 ──
function renderPlayers(players) {
  $('#players-section').classList.remove('hidden');
  $('#player-count-badge').textContent = players.length;
  const grid = $('#players-grid');
  grid.innerHTML = '';

  players.forEach(p => {
    const tierClass = p.tier ? `tier-${p.tier.toLowerCase()}` : 'tier-unranked';
    const rankText = p.tier ? `${p.tierKr} ${p.division || ''} ${p.lp ? p.lp + 'LP' : ''}` : '언랭크';
    const statsText = p.wins + p.losses > 0 ? `${p.wins}승 ${p.losses}패 (${p.winRate}%)` : '';
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="name" title="${p.riotId}">${p.gameName}</div>
      <div class="rank-info">
        <span class="tier ${tierClass}">${rankText}</span>
        <span class="score-badge">${p.score}점</span>
      </div>
      ${statsText ? `<div class="stats">${statsText}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

function renderErrors(errors) {
  const box = $('#errors-box');
  if (!errors || errors.length === 0) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = errors.map(e => `<div class="error-item"><strong>${e.riotId}</strong>: ${e.error}</div>`).join('');
}

function renderTeams(result) {
  $('#teams-section').classList.remove('hidden');
  $('#team1-list').innerHTML = result.team1.map(p => teamPlayerHTML(p)).join('');
  $('#team1-score').textContent = `${result.team1Score}점`;
  $('#team2-list').innerHTML = result.team2.map(p => teamPlayerHTML(p)).join('');
  $('#team2-score').textContent = `${result.team2Score}점`;

  $('#diff-info').innerHTML = result.isRandom
    ? `<span>&#127922; 랜덤 배정 | 점수 차이: <span class="diff-value">${result.diff}</span>점</span>`
    : `<span>&#9878; 최적 밸런스 | 점수 차이: <span class="diff-value">${result.diff}</span>점</span>`;

  // 라운드 정보 표시
  const roundInfo = $('#round-info');
  const roundCount = result.roundCount || 0;
  const currentRound = result.round || (roundCount + 1);
  roundInfo.innerHTML = `현재 <span class="round-num">${currentRound}</span>판째${result.diversity != null ? ` | 팀 변동: ${result.diversity}명` : ''}`;

  $('#teams-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function teamPlayerHTML(p) {
  const tierClass = p.tier ? `tier-${p.tier.toLowerCase()}` : 'tier-unranked';
  const rankText = p.tier ? `${p.tierKr} ${p.division || ''}` : '언랭';
  return `<div class="team-player">
    <span class="tp-name">${p.gameName}</span>
    <span class="tp-rank ${tierClass}">${rankText}</span>
    <span class="tp-score">${p.score}점</span>
  </div>`;
}

// ── 팀 복사 ──
function copyTeams() {
  if (!currentTeams) return;
  const t = currentTeams;
  const fmt = (team) => team.map(p => {
    const rank = p.tier ? `${p.tierKr} ${p.division || ''}` : '언랭';
    return `  ${p.gameName} (${rank}, ${p.score}점)`;
  }).join('\n');
  const text = [`===== LoL 내전 팀 구성 =====`, '', `[블루팀] 총 ${t.team1Score}점`, fmt(t.team1), '', `[레드팀] 총 ${t.team2Score}점`, fmt(t.team2), '', `점수 차이: ${t.diff}점`].join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('팀 구성이 복사되었습니다'));
}

// ── 진행률 / 토스트 ──
function showProgress() { $('#progress-bar').classList.remove('hidden'); $('#progress-fill').style.width = '50%'; $('#progress-text').textContent = '검색 중...'; }
function hideProgress() { $('#progress-bar').classList.add('hidden'); }

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
