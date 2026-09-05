const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const itinerariesRouter = require('./routes/itineraries');
const alertsRouter = require('./routes/alerts');
const careRouter = require('./routes/care');

const app = express();

// PRD 6장/API_CONTRACT.md §0 — 프론트 배포 도메인 + 로컬 개발 주소만 허용
app.use(cors({ origin: env.allowedOrigins }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ data: { ok: true }, error: null }));

app.use('/api/itineraries', itinerariesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/care', careRouter);

app.use((req, res) => {
  res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'route not found' } });
});

app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`GANGWON GO backend listening on port ${env.port}`);
});
