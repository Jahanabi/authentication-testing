const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const playwrightCli = path.join(
  root,
  'node_modules',
  '@playwright',
  'test',
  'cli.js'
);

const args = [
  playwrightCli,
  'test',
  'tests/payment.spec.ts',

  '--config=playwright.payment.config.ts',

  '--project=Desktop Chrome',

  '--workers=1',

  '--headed',
];

console.log('');
console.log('========================================');
console.log(' HappyPrancer Payment Test Suite');
console.log('========================================');
console.log('');
console.log('Project : Desktop Chrome');
console.log('Workers : 1');
console.log('Mode    : Headed');
console.log('');
console.log('Starting Playwright...');
console.log('');

const child = spawn(
  process.execPath,
  args,
  {
    cwd: root,
    env: process.env,
    shell: false,
    windowsHide: false,
  }
);

child.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('error', (error) => {
  console.error(
    '\nFailed to start Playwright:',
    error.message
  );

  process.exit(1);
});

child.on('close', (code) => {
  console.log('');

  console.log('========================================');
  console.log(' Payment Test Suite Finished');
  console.log('========================================');

  console.log(
    `Exit code: ${code}`
  );

  if (code !== 0) {
    process.exit(code || 1);
  }
});