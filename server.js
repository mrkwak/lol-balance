// 로컬 개발 서버 (Express + 인메모리 스토어)
// Vercel 배포 시에는 api/ 디렉토리의 서버리스 함수가 사용됨
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트 (Vercel 서버리스 함수와 동일한 핸들러)
app.all('/api/room', require('./api/room'));
app.all('/api/search', require('./api/search'));
app.all('/api/teams', require('./api/teams'));
app.all('/api/manual', require('./api/manual'));

// SPA 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  LoL 내전 밸런서 서버 실행 중`);
  console.log(`  로컬:   http://localhost:${PORT}`);
  console.log(`  API 키: ${process.env.RIOT_API_KEY ? '설정됨' : '미설정 (.env 파일 확인)'}`);
  console.log(`  저장소: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis' : '인메모리 (로컬 전용)'}\n`);
});
