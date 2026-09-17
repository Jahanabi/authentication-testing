
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const dotenv = require('dotenv');

dotenv.config();

// =========================================================
// PATHS
// =========================================================

const resultsPath = path.join(
  process.cwd(),
  'test-results',
  'results.json'
);

const outputDirectory = path.join(
  process.cwd(),
  'reports',
  'excel'
);

// Create output folder if it does not exist
fs.mkdirSync(outputDirectory, {
  recursive: true,
});

// =========================================================
// READ .ENV
// =========================================================

function getWebsiteName() {
  const url =
    process.env.BASE_URL ||
    process.env.SIGNUP_URL ||
    process.env.LOGIN_URL ||
    'unknown-website';

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.hostname
      .replace(/^www\./, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return 'unknown-website';
  }
}

// =========================================================
// NORMALIZE STATUS
// =========================================================

function normalizeStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'passed':
      return 'PASS';

    case 'failed':
      return 'FAIL';

    case 'skipped':
      return 'SKIPPED';

    case 'timedout':
      return 'TIMEOUT';

    case 'interrupted':
      return 'INTERRUPTED';

    default:
      return String(status || 'UNKNOWN').toUpperCase();
  }
}

// =========================================================
// DETERMINE FEATURE
// =========================================================

function getFeature(title) {
  const upperTitle = title.toUpperCase();

  if (upperTitle.includes('SIGNUP-')) {
    return 'Signup';
  }

  if (upperTitle.includes('LOGIN-')) {
    return 'Login';
  }

  return 'Other';
}

// =========================================================
// TEST CASE ID
// =========================================================

function getTestCaseId(title) {
  const match = title.match(
    /\b((?:LOGIN|SIGNUP)-\d+)\b/i
  );

  return match
    ? match[1].toUpperCase()
    : '';
}

// =========================================================
// ERROR MESSAGE
// =========================================================

function getErrorMessage(test) {
  if (!test.results || !test.results.length) {
    return '';
  }

  const result =
    test.results[test.results.length - 1];

  if (result.error?.message) {
    return result.error.message;
  }

  if (
    Array.isArray(result.errors) &&
    result.errors.length
  ) {
    return result.errors
      .map(error => {
        if (typeof error === 'string') {
          return error;
        }

        return error.message || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

// =========================================================
// GET DURATION
// =========================================================

function getDuration(test) {
  if (!test.results || !test.results.length) {
    return 0;
  }

  const duration = test.results.reduce(
    (total, result) => {
      return total + (result.duration || 0);
    },
    0
  );

  return Number(
    (duration / 1000).toFixed(2)
  );
}

// =========================================================
// DETECT BROWSER / PROJECT
// =========================================================

function getProjectName(test) {
  return test.projectName || 'Unknown';
}

// =========================================================
// EXTRACT TESTS FROM PLAYWRIGHT JSON
// =========================================================

function extractTests(report) {
  const testCases = [];

  function walk(node) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node.specs)) {
      for (const spec of node.specs) {

        const title = spec.title || '';

        if (!Array.isArray(spec.tests)) {
          continue;
        }

        for (const test of spec.tests) {

          const status =
            test.status ||
            test.results?.at(-1)?.status ||
            'unknown';

          testCases.push({
            id: getTestCaseId(title),
            feature: getFeature(title),
            scenario: title,
            browser: getProjectName(test),
            status: normalizeStatus(status),
            duration: getDuration(test),
            error: getErrorMessage(test),
          });
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (
        key === 'specs' ||
        key === 'tests'
      ) {
        continue;
      }

      const value = node[key];

      if (
        value &&
        typeof value === 'object'
      ) {
        if (Array.isArray(value)) {
          for (const item of value) {
            walk(item);
          }
        } else {
          walk(value);
        }
      }
    }
  }

  walk(report);

  return testCases;
}

// =========================================================
// REMOVE EXACT DUPLICATES
// =========================================================

function removeDuplicates(testCases) {
  const map = new Map();

  for (const test of testCases) {
    const key = [
      test.id,
      test.scenario,
      test.browser,
    ].join('|');

    map.set(key, test);
  }

  return [...map.values()];
}

// =========================================================
// STYLE HEADER
// =========================================================

function styleHeader(row) {
  row.eachCell(cell => {
    cell.font = {
      bold: true,
      color: 'FFFFFF',
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: '1F4E78',
      },
    };

    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    cell.border = {
      top: {
        style: 'thin',
      },
      left: {
        style: 'thin',
      },
      bottom: {
        style: 'thin',
      },
      right: {
        style: 'thin',
      },
    };
  });

  row.height = 28;
}

// =========================================================
// STYLE BODY
// =========================================================

function styleBody(sheet) {
  sheet.eachRow((row, rowNumber) => {

    if (rowNumber === 1) {
      return;
    }

    row.eachCell(cell => {
      cell.alignment = {
        vertical: 'top',
        wrapText: true,
      };

      cell.border = {
        top: {
          style: 'thin',
          color: {
            argb: 'D9E1F2',
          },
        },
        left: {
          style: 'thin',
          color: {
            argb: 'D9E1F2',
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: 'D9E1F2',
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: 'D9E1F2',
          },
        },
      };
    });
  });
}

// =========================================================
// STATUS FORMATTING
// =========================================================

function applyStatusFormatting(sheet) {
  sheet.getColumn('E').eachCell(
    (cell, rowNumber) => {

      if (rowNumber === 1) {
        return;
      }

      const value = cell.value;

      if (value === 'PASS') {
        cell.font = {
          bold: true,
          color: '006100',
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'E2F0D9',
          },
        };
      }

      if (value === 'FAIL') {
        cell.font = {
          bold: true,
          color: '9C0006',
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FCE4D6',
          },
        };
      }

      if (
        value === 'SKIPPED' ||
        value === 'TIMEOUT'
      ) {
        cell.font = {
          bold: true,
          color: '7F6000',
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FFF2CC',
          },
        };
      }
    }
  );
}

// =========================================================
// CREATE LOGIN / SIGNUP SHEET
// =========================================================

function createTestSheet(
  workbook,
  sheetName,
  testCases
) {
  const sheet =
    workbook.addWorksheet(sheetName);

  sheet.columns = [
    {
      header: 'Test Case ID',
      key: 'id',
      width: 18,
    },
    {
      header: 'Feature',
      key: 'feature',
      width: 14,
    },
    {
      header: 'Scenario',
      key: 'scenario',
      width: 55,
    },
    {
      header: 'Browser / Device',
      key: 'browser',
      width: 24,
    },
    {
      header: 'Status',
      key: 'status',
      width: 14,
    },
    {
      header: 'Duration (sec)',
      key: 'duration',
      width: 16,
    },
    {
      header: 'Error / Actual Result',
      key: 'error',
      width: 65,
    },
  ];

  for (const test of testCases) {
    sheet.addRow(test);
  }

  styleHeader(sheet.getRow(1));
  styleBody(sheet);

  applyStatusFormatting(sheet);

  // Number format
  sheet.getColumn('F').numFmt =
    '0.00';

  // Freeze header
  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  // Filter
  sheet.autoFilter = {
    from: 'A1',
    to: 'G1',
  };

  return sheet;
}

// =========================================================
// CREATE SUMMARY
// =========================================================

function createSummarySheet(
  workbook,
  testCases,
  website
) {
  const sheet =
    workbook.addWorksheet('Summary');

  const total = testCases.length;

  const passed = testCases.filter(
    test => test.status === 'PASS'
  ).length;

  const failed = testCases.filter(
    test => test.status === 'FAIL'
  ).length;

  const skipped = testCases.filter(
    test => test.status === 'SKIPPED'
  ).length;

  const timeout = testCases.filter(
    test => test.status === 'TIMEOUT'
  ).length;

  sheet.mergeCells('A1:B1');

  sheet.getCell('A1').value =
    'Authentication Test Report';

  sheet.getCell('A1').font = {
    bold: true,
    color: 'FFFFFF',
    size: 14,
  };

  sheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: '1F4E78',
    },
  };

  sheet.getCell('A1').alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  sheet.getRow(1).height = 30;

  sheet.addRows([
    ['Website', website],
    [
      'Generated On',
      new Date().toLocaleString(),
    ],
    [],
    ['Metric', 'Count'],
    ['Total Tests', total],
    ['Passed', passed],
    ['Failed', failed],
    ['Skipped', skipped],
    ['Timeout', timeout],
  ]);

  const headerRow = sheet.getRow(5);

  styleHeader(headerRow);

  sheet.getColumn('A').width = 25;
  sheet.getColumn('B').width = 35;

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 5,
    },
  ];
}

// =========================================================
// MAIN
// =========================================================

async function main() {

  if (!fs.existsSync(resultsPath)) {
    throw new Error(
      `Playwright results file not found:\n${resultsPath}\n\n` +
      'Run the Playwright tests first.'
    );
  }

  const report = JSON.parse(
    fs.readFileSync(
      resultsPath,
      'utf8'
    )
  );

  const website =
    getWebsiteName();

  let testCases =
    extractTests(report);

  testCases =
    removeDuplicates(testCases);

  if (!testCases.length) {
    throw new Error(
      'No tests were found in results.json.'
    );
  }

  const loginTests =
    testCases.filter(
      test => test.feature === 'Login'
    );

  const signupTests =
    testCases.filter(
      test => test.feature === 'Signup'
    );

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Playwright Authentication Automation';

  workbook.created = new Date();

  // =======================================================
  // SUMMARY
  // =======================================================

  createSummarySheet(
    workbook,
    testCases,
    website
  );

  // =======================================================
  // LOGIN
  // =======================================================

  if (loginTests.length) {
    createTestSheet(
      workbook,
      'Login',
      loginTests
    );
  } else {
    const sheet =
      workbook.addWorksheet('Login');

    sheet.getCell('A1').value =
      'No Login tests found.';
  }

  // =======================================================
  // SIGNUP
  // =======================================================

  if (signupTests.length) {
    createTestSheet(
      workbook,
      'Signup',
      signupTests
    );
  } else {
    const sheet =
      workbook.addWorksheet('Signup');

    sheet.getCell('A1').value =
      'No Signup tests found.';
  }

  // =======================================================
  // OUTPUT
  // =======================================================

  const outputFile = path.join(
    outputDirectory,
    `${website}-authentication-report.xlsx`
  );

  await workbook.xlsx.writeFile(
    outputFile
  );

  console.log(
    '\nExcel report generated successfully!'
  );

  console.log(
    `Website     : ${website}`
  );

  console.log(
    `Total tests : ${testCases.length}`
  );

  console.log(
    `Login tests : ${loginTests.length}`
  );

  console.log(
    `Signup tests: ${signupTests.length}`
  );

  console.log(
    `Output      : ${outputFile}\n`
  );
}

main().catch(error => {
  console.error(
    '\nFailed to generate Excel report:\n'
  );

  console.error(error);

  process.exit(1);
});

