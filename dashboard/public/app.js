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

// Auto-Execution DOM elements
const autoTargetPanel = document.getElementById('autoTargetPanel');
const manualPanel = document.getElementById('manualPanel');
const autoInstLabel = document.getElementById('autoInstLabel');
const autoModuleLabel = document.getElementById('autoModuleLabel');
const autoProject = document.getElementById('autoProject');
const autoUrls = document.getElementById('autoUrls');
const rerunAuto = document.getElementById('rerunAuto');

let institutions = [];

function updateStatus(status) {
  const norm = String(status || 'idle').toLowerCase();
  statusEl.textContent = status || 'idle';
  statusEl.className = '';
  if (norm === 'queued') statusEl.classList.add('status-queued');
  else if (norm === 'running') statusEl.classList.add('status-running');
  else if (norm === 'completed' || norm === 'passed') statusEl.classList.add('status-passed');
  else if (norm === 'failed') statusEl.classList.add('status-failed');
  else if (norm === 'error') statusEl.classList.add('status-error');
}

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

function updateModuleOptions() {
  const institution = institutionSelect.value;
  const isHappyPrancer = institution === 'happyprancer';

  const currentModule = moduleSelect.value;

  moduleSelect.innerHTML = `
    <option value="all">All Login + Signup Cases (42)</option>
    <option value="login">All Login Cases (LOGIN-001 to LOGIN-020)</option>
    <option value="signup">All Signup Cases (SIGNUP-001 to SIGNUP-022)</option>
    ${isHappyPrancer
      ? '<option value="payment">HappyPrancer Payment Cases</option>'
      : ''
    }
  `;

  if (
    currentModule === 'payment' &&
    !isHappyPrancer
  ) {
    moduleSelect.value = 'all';
  } else if (
    [...moduleSelect.options].some(
      (option) => option.value === currentModule
    )
  ) {
    moduleSelect.value = currentModule;
  }

  updateProjectOptions();
}

function updateProjectOptions() {
  const isPayment =
    institutionSelect.value === 'happyprancer' &&
    moduleSelect.value === 'payment';

  if (isPayment) {
    projectSelect.innerHTML = `
      <option value="Payment Desktop Chrome">
        Desktop Chrome only
      </option>
    `;
    projectSelect.value = 'Payment Desktop Chrome';
    return;
  }

  projectSelect.innerHTML = `
    <option value="Desktop Chrome">
      Desktop Chrome only
    </option>
    <option value="Mobile Chrome">
      Mobile Chrome
    </option>
    <option value="">
      All devices (Desktop, Tablet, Mobile)
    </option>
  `;
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

  updateStatus(run.status || 'idle');

  if (run.summary) {
    resultsEl.textContent = `Passed: ${run.summary.passed}  Failed: ${run.summary.failed}  Skipped: ${run.summary.skipped}`;
    resultsEl.parentElement.classList.toggle('fail', Number(run.summary.failed || 0) > 0);
  }

  if (typeof run.logs === 'string' && run.logs.length) {
    logs.textContent = run.logs;
    logs.scrollTop = logs.scrollHeight;
  }

  setReport(htmlReport, htmlEmpty, run.htmlReportUrl);
  setReport(excelReport, excelEmpty, run.excelReportUrl);
  if (runLocal) runLocal.disabled = run.status === 'running';
  if (rerunAuto) rerunAuto.disabled = run.status === 'running';
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
  updateModuleOptions();  
}

let githubPollTimer = null;

function stopGithubPolling() {
  if (githubPollTimer) {
    clearTimeout(githubPollTimer);
    githubPollTimer = null;
  }
}

async function pollGithubRun(startedAt, workflow, sessionKey) {
  try {
    const params = new URLSearchParams({
      startedAt,
    });

    if (workflow) {
      params.set('workflow', workflow);
    }

    const response = await fetch(
      `/api/github/status?${params.toString()}`,
      {
        cache: 'no-store',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || 'Unable to check GitHub Actions status.'
      );
    }

    updateStatus(data.status || 'queued');

    if (data.message) {
      logs.textContent = `\n${data.message}\n`;

      if (data.actionsUrl) {
        logs.textContent += `Actions: ${data.actionsUrl}\n`;
      }
    }

    if (data.summary) {
      resultsEl.textContent =
        `Passed: ${data.summary.passed}  ` +
        `Failed: ${data.summary.failed}  ` +
        `Skipped: ${data.summary.skipped}`;

      resultsEl.parentElement.classList.toggle(
        'fail',
        Number(data.summary.failed || 0) > 0
      );
    }

    setReport(
      htmlReport,
      htmlEmpty,
      data.htmlReportUrl
    );

    setReport(
      excelReport,
      excelEmpty,
      data.excelReportUrl
    );

    if (
      data.status === 'completed' ||
      data.status === 'failed' ||
      data.status === 'cancelled'
    ) {
      stopGithubPolling();
      if (runLocal) runLocal.disabled = false;
      if (rerunAuto) {
        rerunAuto.disabled = false;
        rerunAuto.style.display = 'inline-block';
      }

      if (data.status === 'completed') {
        updateStatus(data.conclusion === 'success' ? 'passed' : 'failed');
      } else {
        updateStatus('failed');
      }

      if (sessionKey) {
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({
            dispatchedAt: startedAt,
            workflow,
            status: data.conclusion === 'success' ? 'passed' : 'failed',
            summary: data.summary,
            htmlReportUrl: data.htmlReportUrl,
            excelReportUrl: data.excelReportUrl,
          }));
        } catch {}
      }
      return;
    }

    githubPollTimer = setTimeout(
      () => pollGithubRun(startedAt, workflow, sessionKey),
      5000
    );

  } catch (error) {
    logs.textContent +=
      `\nStatus check: ${error.message}\n`;

    githubPollTimer = setTimeout(
      () => pollGithubRun(startedAt, workflow, sessionKey),
      8000
    );
  }
}

// Extract Auto-Test config from server bootstrap or pathname
function getAutoConfig() {
  if (window.AUTO_TEST_CONFIG && window.AUTO_TEST_CONFIG.autoRun) {
    return window.AUTO_TEST_CONFIG;
  }

  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && !['auth', 'api', 'reports'].includes(parts[0].toLowerCase())) {
    const rawMod = decodeURIComponent(parts[1]).replace(/\s+/g, '+').toLowerCase();
    if (rawMod === 'alllogin+signup' || rawMod === 'all') {
      const urlParams = new URLSearchParams(window.location.search);
      const rawDev = urlParams.get('device') || urlParams.get('project');
      let dev = 'Desktop Chrome';
      if (rawDev) {
        if (rawDev.toLowerCase().includes('mobile')) dev = 'Mobile Chrome';
        else if (rawDev.toLowerCase().includes('tablet')) dev = 'Tablet';
        else if (rawDev.toLowerCase() === 'all') dev = '';
      }
      return {
        institutionId: parts[0].toLowerCase(),
        institutionLabel: parts[0],
        module: 'alllogin+signup',
        project: dev,
        autoRun: true,
      };
    }
  }

  return null;
}

// Start auto execution without requiring user interaction
async function startAutoExecution(config, isForce = false) {
  stopGithubPolling();
  updateStatus('queued');
  resultsEl.textContent = 'Waiting for test results...';
  setReport(htmlReport, htmlEmpty, null);
  setReport(excelReport, excelEmpty, null);

  const selectedDevice = autoProject ? autoProject.value : (config.project || 'Desktop Chrome');
  logs.textContent = `[Auto-Execution Initiated]\nInstitution : ${config.institutionLabel || config.institutionId}\nModule      : ${config.module} (All Login + Signup Tests)\nDevice      : ${selectedDevice || 'All devices (Desktop, Tablet, Mobile)'}\nMode        : Automated trigger via URL\n\n`;

  const sessionKey = `autorun_${config.institutionId}_${config.module}`;

  let githubConfigured = true;
  try {
    const instRes = await fetch('/api/institutions');
    const instData = await instRes.json();
    githubConfigured = Boolean(instData.githubConfigured);
  } catch {}

  const dispatchPayload = {
    institutionId: config.institutionId,
    institution: config.institutionId,
    module: config.module,
    project: selectedDevice,
    force: isForce,
  };

  if (githubConfigured) {
    logs.textContent += 'Connecting to GitHub Actions workflow...\n';
    try {
      const response = await fetch('/api/github/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        logs.textContent += `\nError: ${data.error || 'Failed to start GitHub Actions workflow.'}\n`;
        if (data.details) logs.textContent += `Details: ${data.details}\n`;
        updateStatus('error');
        if (rerunAuto) {
          rerunAuto.disabled = false;
          rerunAuto.style.display = 'inline-block';
        }
        return;
      }

      updateStatus('running');
      if (data.reused) {
        logs.textContent += `\n[Idempotency] ${data.message || 'Reconnected to ongoing workflow dispatch.'}\n`;
      } else {
        logs.textContent += '\nGitHub Actions workflow dispatched successfully.\n';
      }

      if (data.actionsUrl) {
        logs.textContent += `Actions: ${data.actionsUrl}\n`;
      }
      logs.textContent += 'Monitoring test suite execution and report generation...\n';

      sessionStorage.setItem(sessionKey, JSON.stringify({
        dispatchedAt: data.dispatchedAt,
        workflow: data.workflow,
        status: 'running',
        project: selectedDevice,
      }));

      pollGithubRun(data.dispatchedAt, data.workflow, sessionKey);
    } catch (err) {
      logs.textContent += `\nDispatch request failed: ${err.message}\n`;
      updateStatus('error');
      if (rerunAuto) {
        rerunAuto.disabled = false;
        rerunAuto.style.display = 'inline-block';
      }
    }
  } else {
    logs.textContent += 'Local environment detected (GITHUB_TOKEN not configured).\nTriggering local Playwright test runner via /api/run...\n';
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchPayload),
      });

      const data = await response.json();
      if (!response.ok) {
        logs.textContent += `\nError: ${data.error || 'Failed to start local test run.'}\n`;
        updateStatus('error');
        return;
      }

      updateStatus('running');
      logs.textContent += 'Local Playwright test run is now active. Streaming output...\n';
    } catch (err) {
      logs.textContent += `\nLocal runner error: ${err.message}\n`;
      updateStatus('error');
    }
  }
}

// Manual dispatch handlers (Homepage mode)
runLocal.addEventListener('click', async () => {
  stopGithubPolling();
  logs.textContent = 'Requesting GitHub Actions...\n';
  updateStatus('queued');
  resultsEl.textContent = 'Waiting for test results...';
  setReport(htmlReport, htmlEmpty, null);
  setReport(excelReport, excelEmpty, null);
  runLocal.disabled = true;

  try {
    const response = await fetch('/api/github/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    });

    const data = await response.json();

    if (!response.ok) {
      logs.textContent += data.error || 'Unable to start GitHub Actions.';
      updateStatus('failed');
      runLocal.disabled = false;
      return;
    }

    logs.textContent +=
      '\nGitHub Actions started successfully.\n' +
      (data.actionsUrl ? `Actions: ${data.actionsUrl}\n` : '') +
      '\nWaiting for Playwright results...\n';

    pollGithubRun(data.dispatchedAt, data.workflow);
  } catch (error) {
    logs.textContent += `\n${error.message}\n`;
    updateStatus('failed');
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

institutionSelect.addEventListener('change', () => {
  renderUrls();
  updateModuleOptions();
});
moduleSelect.addEventListener('change', updateProjectOptions);

if (rerunAuto) {
  rerunAuto.addEventListener('click', () => {
    const config = getAutoConfig();
    if (config) {
      const sessionKey = `autorun_${config.institutionId}_${config.module}`;
      sessionStorage.removeItem(sessionKey);
      rerunAuto.disabled = true;
      startAutoExecution(config, true);
    }
  });
}

if (autoProject) {
  autoProject.addEventListener('change', () => {
    const config = getAutoConfig();
    if (config) {
      config.project = autoProject.value;
      const sessionKey = `autorun_${config.institutionId}_${config.module}`;
      sessionStorage.removeItem(sessionKey);
      if (rerunAuto) rerunAuto.disabled = true;
      startAutoExecution(config, true);
    }
  });
}

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

// App Initialization
async function init() {
  const autoConfig = getAutoConfig();

  if (autoConfig) {
    // URL-Based Automatic Execution Mode
    if (autoTargetPanel) autoTargetPanel.hidden = false;
    if (manualPanel) manualPanel.hidden = true;

    if (autoInstLabel) {
      autoInstLabel.textContent = autoConfig.institutionLabel || autoConfig.institutionId;
    }

    if (autoProject) {
      autoProject.value = autoConfig.project !== undefined ? autoConfig.project : 'Desktop Chrome';
    }

    if (autoUrls) {
      if (autoConfig.loginUrl || autoConfig.signupUrl) {
        autoUrls.innerHTML = `
          <div><strong>Login:</strong> ${autoConfig.loginUrl || ''}</div>
          <div><strong>Signup:</strong> ${autoConfig.signupUrl || ''}</div>
        `;
      } else {
        autoUrls.innerHTML = '';
      }
    }

    const sessionKey = `autorun_${autoConfig.institutionId}_${autoConfig.module}`;
    const saved = sessionStorage.getItem(sessionKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.dispatchedAt && parsed.workflow) {
          logs.textContent = `[Auto-Execution] Active session restored from ${new Date(parsed.dispatchedAt).toLocaleTimeString()}.\n`;
          if (parsed.status) updateStatus(parsed.status);
          if (parsed.summary) {
            resultsEl.textContent = `Passed: ${parsed.summary.passed}  Failed: ${parsed.summary.failed}  Skipped: ${parsed.summary.skipped}`;
            resultsEl.parentElement.classList.toggle('fail', Number(parsed.summary.failed || 0) > 0);
          }
          if (parsed.htmlReportUrl) setReport(htmlReport, htmlEmpty, parsed.htmlReportUrl);
          if (parsed.excelReportUrl) setReport(excelReport, excelEmpty, parsed.excelReportUrl);

          if (parsed.status === 'running' || parsed.status === 'queued') {
            pollGithubRun(parsed.dispatchedAt, parsed.workflow, sessionKey);
            return;
          } else {
            if (rerunAuto) rerunAuto.style.display = 'inline-block';
            return;
          }
        }
      } catch {}
    }

    // No existing active session: automatically start execution immediately!
    startAutoExecution(autoConfig, false);
  } else {
    // Normal Homepage Mode
    if (autoTargetPanel) autoTargetPanel.hidden = true;
    if (manualPanel) manualPanel.hidden = false;
    loadInstitutions().catch((error) => {
      logs.textContent = `Failed to load institutions: ${error.message}`;
    });
  }
}

init();
