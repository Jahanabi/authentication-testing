const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const {
  loadInstitutions,
  getInstitution,
  publicInstitution,
  validateInstitutionConfig,
  playwrightEnv,
} = require('../config/institution-config');

dotenv.config();

const root = path.join(__dirname, '..');

/**
 * Parse command-line arguments
 */
function parseArgs(argv) {
  const args = {
    institution: process.env.INSTITUTION || 'happyprancer',
    module: process.env.TEST_MODULE || 'all',
    project: process.env.PLAYWRIGHT_PROJECT || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--institution' && next) {
      args.institution = next;
      index += 1;
    } else if (current === '--module' && next) {
      args.module = next;
      index += 1;
    } else if (current === '--project' && next) {
      args.project = next === 'all' ? '' : next;
      index += 1;
    }
  }

  return args;
}

/**
 * Select Playwright spec files
 */
function getSpecFiles(moduleName) {
  switch (String(moduleName || 'all').toLowerCase()) {
    case 'login':
      return ['tests/login.spec.ts'];

    case 'signup':
      return ['tests/signup.spec.ts'];

    case 'all':
      return [
        'tests/login.spec.ts',
        'tests/signup.spec.ts',
      ];

    default:
      throw new Error(
        'Module must be login, signup, or all'
      );
  }
}

/**
 * Use Node executable directly.
 */
function playwrightCommand() {
  return process.execPath;
}

/**
 * Direct Playwright CLI
 */
function playwrightCli() {
  return path.join(
    root,
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
  );
}

/**
 * Run child process
 */
function runCommand(command, args, env, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: false,
      windowsHide: false,
    });

    child.stdout.on('data', (chunk) => {
      onData(chunk.toString());
    });

    child.stderr.on('data', (chunk) => {
      onData(chunk.toString());
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(0);
        return;
      }

      const error = new Error(
        `${command} ${args.join(' ')} exited with code ${code}`
      );

      error.code = code;
      reject(error);
    });
  });
}

/**
 * Read Playwright JSON results
 */
function readTestSummary() {
  const resultsPath = path.join(
    root,
    'test-results',
    'results.json'
  );

  try {
    const data = JSON.parse(
      fs.readFileSync(resultsPath, 'utf8')
    );

    const stats = data.stats || {};

    return {
      passed: Number(stats.expected || 0),
      failed: Number(stats.unexpected || 0),
      skipped: Number(stats.skipped || 0),
      flaky: Number(stats.flaky || 0),
    };
  } catch {
    return null;
  }
}

/**
 * Run authentication tests
 */
async function runAuthTests(
  options,
  onData = () => {}
) {
  const institution = getInstitution(
    options.institution
  );

  const missing = validateInstitutionConfig(
    institution,
    options.module
  );

  if (missing.length) {
    throw new Error(
      `Cannot run authentication tests for ${institution.label}.\n` +
      `Missing configuration:\n${missing.join('\n')}`
    );
  }

  const specs = getSpecFiles(options.module);

  /*
   * Get environment variables for the selected institution.
   */
  const institutionEnv = playwrightEnv(institution);

  /*
   * Force real institution testing.
   * Do not allow the local demo URL to override it.
   */
  const env = {
    ...process.env,
    ...institutionEnv,

    AUTH_TEST_TARGET: 'institution',

    BASE_URL: institution.loginUrl,
    SIGNUP_URL: institution.signupUrl,
  };

  /*
   * Prevent external grep filters from removing tests.
   */
  delete env.PLAYWRIGHT_GREP;
  delete env.PWTEST_GREP;

  /*
   * Build Playwright command.
   *
   * This intentionally matches the command that is already
   * working successfully from your terminal:
   *
   * npx playwright test ...
   * --project="Desktop Chrome"
   * --workers=1
   * --headed
   */
  const playwrightArgs = [
    playwrightCli(),
    'test',
    ...specs,

    '--workers',
    '1',

    '--headed',
  ];

  if (options.project) {
    playwrightArgs.push(
      '--project',
      options.project
    );
  }

  /*
   * Display selected configuration.
   */
  onData(
    `Institution : ${institution.label} (${institution.id})\n`
  );

  onData(
    `Login URL   : ${institution.loginUrl}\n`
  );

  onData(
    `Signup URL  : ${institution.signupUrl}\n`
  );

  onData(
    `Login email : ${
      institution.credentials &&
      institution.credentials.loginEmail
        ? 'configured'
        : 'missing'
    }\n`
  );

  onData(
    `Module      : ${options.module}\n`
  );

  onData(
    `Specs       : ${specs.join(', ')}\n`
  );

  onData(
    `Devices     : ${
      options.project ||
      'Desktop Chrome, Tablet, Mobile Chrome'
    }\n`
  );

  onData(
    'Workers     : 1\n'
  );

  onData(
    'Browser     : headed\n'
  );

  onData(
    'Scope       : execute all LOGIN-* and SIGNUP-* cases\n\n'
  );

  let failed = false;

  /*
   * Run Playwright
   */
  try {
    await runCommand(
      playwrightCommand(),
      playwrightArgs,
      env,
      onData
    );
  } catch (error) {
    failed = true;

    onData(
      `\nPlaywright finished with failures ` +
      `(${error.code || 1}).\n`
    );
  }

  /*
   * Generate Excel report if results.json exists.
   */
  const resultsPath = path.join(
    root,
    'test-results',
    'results.json'
  );

  if (fs.existsSync(resultsPath)) {
    try {
      await runCommand(
        process.execPath,
        ['generate-excel-report.js'],
        env,
        onData
      );
    } catch (error) {
      failed = true;

      onData(
        `\nExcel report generation failed: ` +
        `${error.message}\n`
      );
    }
  } else {
    onData(
      '\nExcel report was not generated because ' +
      'Playwright did not produce test-results/results.json.\n'
    );
  }

  /*
   * Determine website hostname.
   */
  const websiteHost = (() => {
    try {
      return new URL(
        institution.loginUrl
      ).hostname.replace(/^www\./, '');
    } catch {
      return institution.id;
    }
  })();

  /*
   * Read final test summary.
   */
  const summary = readTestSummary();

  if (summary) {
    onData(
      `\nResults      : ` +
      `Passed: ${summary.passed} ` +
      `Failed: ${summary.failed} ` +
      `Skipped: ${summary.skipped}\n`
    );
  }

  return {
    institution: publicInstitution(institution),
    failed,
    summary,
    htmlReport: 'reports/html/index.html',
    excelReport:
      `reports/excel/${websiteHost}-authentication-report.xlsx`,
  };
}

module.exports = {
  loadInstitutions,
  getInstitution,
  publicInstitution,
  validateInstitutionConfig,
  parseArgs,
  runAuthTests,
  readTestSummary,
};

/**
 * Run directly from command line
 */
if (require.main === module) {
  const args = parseArgs(
    process.argv.slice(2)
  );

  runAuthTests(
    args,
    (text) => process.stdout.write(text)
  )
    .then((result) => {
      process.stdout.write(
        `\nHTML report : ${result.htmlReport}\n`
      );

      if (result.summary) {
        process.stdout.write(
          `Total tests : ${
            result.summary.passed +
            result.summary.failed +
            result.summary.skipped
          }\n`
        );
      }

      process.stdout.write(
        `Excel report: ${result.excelReport}\n`
      );

      if (result.failed) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}