const institutionSelect = document.getElementById('institution');
const moduleSelect = document.getElementById('module');
const projectSelect = document.getElementById('project');
const urls = document.getElementById('urls');
const configStatus = document.getElementById('configStatus');
const runLocal = document.getElementById('runLocal');
const runGithub = document.getElementById('runGithub');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const logs = document.getElementById('logs');
const htmlReport = document.getElementById('htmlReport');
const htmlEmpty = document.getElementById('htmlEmpty');
const excelReport = document.getElementById('excelReport');
const excelEmpty = document.getElementById('excelEmpty');
const githubNote = document.getElementById('githubNote');

let institutions = [];

function selectedInstitution() {
  return institutions.find((item) => item.id === institutionSelect.value);
}

function configRow(label, configured) {
  return `<div class="${configured ? 'config-ok' : 'config-missing'}">${label}: ${
    configured ? 'configured' : 'missing'
  }</div>`;
}

function renderUrls() {
  const institution = selectedInstitution();

  if (!institution) {
    urls.textContent = '';
    configStatus.innerHTML = '';
    return;
  }

  urls.innerHTML = `
    <div><strong>Login:</strong> ${institution.loginUrl}</div>
    <div><strong>Signup:</strong> ${institution.signupUrl}</div>
  `;

  const config = institution.config || {};
  configStatus.innerHTML = [
    configRow('Login URL', config.loginUrl),
    configRow('Signup URL', config.signupUrl),
    configRow('Login email', config.loginEmail),
    configRow('Login password', config.loginPassword),
    configRow('Signup name', config.signupName),
    configRow('Signup email', config.signupEmail),
    configRow('Signup password', config.signupPassword),
  ].join('');
}

function setReport(linkEl, emptyEl, href) {
  if (href) {
    linkEl.href = href;
    linkEl.hidden = false;
    emptyEl.hidden = true;
    return;
  }

  linkEl.hidden = true;
  emptyEl.hidden = false;
}

function applyRun(run) {
  if (!run) {
    return;
  }

  statusEl.textContent = run.status || 'idle';

  if (run.summary) {
    resultsEl.textContent = `Passed: ${run.summary.passed}  Failed: ${run.summary.failed}  Skipped: ${run.summary.skipped}`;
    resultsEl.parentElement.classList.toggle('fail', run.summary.failed > 0);
  }

  if (typeof run.logs === 'string' && run.logs.length) {
    logs.textContent = run.logs;
    logs.scrollTop = logs.scrollHeight;
  }

  setReport(htmlReport, htmlEmpty, run.htmlReportUrl);
  setReport(excelReport, excelEmpty, run.excelReportUrl);
  runLocal.disabled = run.status === 'running';
}

function payload() {
  return {
    institutionId: institutionSelect.value,
    institution: institutionSelect.value,
    module: moduleSelect.value,
    project: projectSelect.value,
  };
}

async function loadInstitutions() {
  const response = await fetch('/api/institutions');
  const data = await response.json();

  institutions = data.institutions || [];
  institutionSelect.innerHTML = institutions
    .map(
      (institution) =>
        `<option value="${institution.id}">${institution.label}</option>`
    )
    .join('');

  runGithub.hidden = !data.githubConfigured;
  githubNote.textContent = data.githubConfigured
    ? 'GitHub workflow dispatch is configured.'
    : 'Local runs only. Add GITHUB_TOKEN and GITHUB_REPOSITORY to trigger Actions.';

  renderUrls();
}

runLocal.addEventListener('click', async () => {
  logs.textContent = 'Starting local Playwright run...\n';
  statusEl.textContent = 'running';
  runLocal.disabled = true;

  const response = await fetch('/api/run-authentication', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload()),
  });

  const data = await response.json();

  if (!response.ok) {
    logs.textContent += data.error || 'Unable to start the run.';
    statusEl.textContent = 'failed';
    runLocal.disabled = false;
  }
});

runGithub.addEventListener('click', async () => {
  githubNote.textContent = 'Requesting GitHub Actions...';

  const response = await fetch('/api/github/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload()),
  });

  const data = await response.json();
  githubNote.textContent = data.message || data.error || 'Done.';

  if (data.actionsUrl) {
    logs.textContent += `\nGitHub Actions: ${data.actionsUrl}\n`;
  }
});

institutionSelect.addEventListener('change', renderUrls);

const events = new EventSource('/api/run/stream');

events.addEventListener('snapshot', (event) => {
  applyRun(JSON.parse(event.data));
});

events.addEventListener('run', (event) => {
  applyRun(JSON.parse(event.data));
});

events.addEventListener('log', (event) => {
  const data = JSON.parse(event.data);
  logs.textContent += data.chunk || '';
  logs.scrollTop = logs.scrollHeight;
});

loadInstitutions().catch((error) => {
  logs.textContent = `Failed to load institutions: ${error.message}`;
});
