const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  loadInstitutions,
  publicInstitution,
  validateInstitutionConfig,
  runAuthTests,
} = require('../scripts/run-auth-tests');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.join(__dirname, '..');
const publicDir = path.join(__dirname, 'public');

let currentRun = null;
const listeners = new Set();

app.use(express.json());
app.use(express.static(publicDir));
app.use('/reports', express.static(path.join(root, 'reports')));
const institutionMeta = require('../config/institutions.json');

app.get('/auth/:institution/:mode', (req, res) => {
  const institution = institutionMeta[req.params.institution];
  if (!institution || !['login', 'signup', 'dashboard'].includes(req.params.mode)) {
    res.status(404).send('Authentication page not found');
    return;
  }
  if (req.params.mode === 'dashboard') {
    res.sendFile(path.join(publicDir, 'dashboard.html'));
    return;
  }
  const html = fs.readFileSync(path.join(publicDir, 'auth.html'), 'utf8');
  const prefix = String(req.params.institution).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const email = process.env[`${prefix}_LOGIN_EMAIL`] || process.env.LOGIN_EMAIL || 'testuser@example.com';
  const password = process.env[`${prefix}_LOGIN_PASSWORD`] || process.env.LOGIN_PASSWORD || 'Test@1234';
  const safe = (value) => JSON.stringify(String(value)).replace(/</g, '\u003c');
  const script = `<script>window.AUTH_TEST_EMAIL=${safe(email)};window.AUTH_TEST_PASSWORD=${safe(password)};</script>`;
  res.send(html.replace('</head>', `${script}</head>`).replace('setMode(mode);', `setMode(${JSON.stringify(req.params.mode)});`));
});


function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const listener of listeners) {
    listener.write(payload);
  }
}

function dashboardUrl(req) {
  return process.env.DASHBOARD_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, running: Boolean(currentRun) });
});

app.get('/api/institutions', (_req, res) => {
  res.json({
    institutions: Object.values(loadInstitutions()).map(publicInstitution),
    githubConfigured: Boolean(
      process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY
    ),
  });
});

app.get('/api/run/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`event: snapshot\ndata: ${JSON.stringify(currentRun || { status: 'idle' })}\n\n`);

  listeners.add(res);
  req.on('close', () => listeners.delete(res));
});

app.post(['/api/run', '/api/run-authentication'], async (req, res) => {
  if (currentRun && currentRun.status === 'running') {
    res.status(409).json({ error: 'A test run is already in progress.' });
    return;
  }

  const institution = String(
    req.body.institutionId || req.body.institution || ''
  ).trim();
  const moduleName = String(req.body.module || 'all').trim();
  const project = String(req.body.project || '').trim();
  const institutions = loadInstitutions();

  if (!institutions[institution]) {
    res.status(400).json({
      error: `Unknown institution. Choose one of: ${Object.keys(institutions).join(', ')}`,
    });
    return;
  }

  const missing = validateInstitutionConfig(
    institutions[institution],
    moduleName
  );

  if (missing.length) {
    res.status(400).json({
      error: `Cannot run authentication tests.\nMissing configuration:\n${missing.join('\n')}`,
      missing,
    });
    return;
  }

  currentRun = {
    id: Date.now().toString(),
    status: 'running',
    institution,
    institutionLabel: institutions[institution].label,
    module: moduleName,
    project: project || 'all-projects',
    logs: '',
    startedAt: new Date().toISOString(),
    htmlReportUrl: null,
    excelReportUrl: null,
    summary: null,
    error: null,
  };

  broadcast('run', currentRun);
  res.json({ ok: true, run: currentRun });

  try {
    const result = await runAuthTests(
      { institution, module: moduleName, project },
      (chunk) => {
        currentRun.logs += chunk;
        broadcast('log', { chunk });
      }
    );

    currentRun.status = result.failed ? 'failed' : 'completed';
    currentRun.finishedAt = new Date().toISOString();
    currentRun.summary = result.summary;
    currentRun.htmlReportUrl = '/reports/html/index.html';
    currentRun.excelReportUrl = fs.existsSync(path.join(root, result.excelReport))
      ? `/${result.excelReport.replace(/\\/g, '/')}`
      : null;
    broadcast('run', currentRun);
  } catch (error) {
    currentRun.status = 'failed';
    currentRun.finishedAt = new Date().toISOString();
    currentRun.error = error.message;
    currentRun.logs += `\n${error.message}\n`;
    broadcast('run', currentRun);
  }
});

app.post('/api/github/dispatch', async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'auth-tests.yml';
  const ref = process.env.GITHUB_REF || 'main';

  if (!token || !repository) {
    res.status(400).json({
      error: 'Set GITHUB_TOKEN and GITHUB_REPOSITORY to trigger GitHub Actions from this dashboard.',
    });
    return;
  }

  const institution = String(
    req.body.institutionId || req.body.institution || ''
  ).trim();
  const moduleName = String(req.body.module || 'all').trim();
  const project = String(req.body.project || '').trim();
  const institutions = loadInstitutions();

  if (!institutions[institution]) {
    res.status(400).json({
      error: `Unknown institution. Choose one of: ${Object.keys(institutions).join(', ')}`,
    });
    return;
  }

  const origin = dashboardUrl(req);

  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref,
        inputs: {
          institution,
          module: moduleName,
          project: project || 'Desktop Chrome',
          dashboard_url: origin,
        },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    res.status(response.status).json({
      error: 'GitHub workflow dispatch failed.',
      details,
    });
    return;
  }

  res.json({
    ok: true,
    actionsUrl: `https://github.com/${repository}/actions/workflows/${workflow}`,
    message: 'GitHub Actions run requested. Open the Actions tab for the generated report link.',
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Auth test dashboard: http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the other dashboard process, then run npm run dashboard again.`
    );
    process.exit(1);
  }

  throw error;
});
