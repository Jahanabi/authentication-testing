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
  'payment-results.json'
);

const outputDirectory = path.join(
  process.cwd(),
  'reports',
  'excel'
);

fs.mkdirSync(outputDirectory, {
  recursive: true,
});

// =========================================================
// STATUS
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
// TEST CASE ID
// Supports:
// PAYMENT-001
// PAYMENT-015.2
// PAYMENT-SEC-001
// PAYMENT-SEC-012
// =========================================================

function getTestCaseId(title) {
  const match = title.match(
    /\bPAYMENT-(?:SEC-)?\d+(?:\.\d+)?\b/i
  );

  return match
    ? match[0].toUpperCase()
    : '';
}

// =========================================================
// FEATURE
// =========================================================

function getFeature(title) {
  if (/PAYMENT-SEC-/i.test(title)) {
    return 'Security';
  }

  return 'Payment';
}

// =========================================================
// ERROR
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
// DURATION
// =========================================================

function getDuration(test) {
  if (!test.results || !test.results.length) {
    return 0;
  }

  const duration = test.results.reduce(
    (total, result) =>
      total + (result.duration || 0),
    0
  );

  return Number(
    (duration / 1000).toFixed(2)
  );
}

// =========================================================
// EXTRACT PAYMENT + SECURITY TESTS
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

        // Include both:
        // PAYMENT-001
        // PAYMENT-015.2
        // PAYMENT-SEC-001
        // PAYMENT-SEC-012
        if (
          !/PAYMENT-(?:SEC-)?\d+(?:\.\d+)?/i.test(
            title
          )
        ) {
          continue;
        }

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

            browser:
              test.projectName || 'Unknown',

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
// REMOVE DUPLICATES
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
// HEADER STYLE
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
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  row.height = 28;
}

// =========================================================
// BODY STYLE
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
          color: { argb: 'D9E1F2' },
        },
        left: {
          style: 'thin',
          color: { argb: 'D9E1F2' },
        },
        bottom: {
          style: 'thin',
          color: { argb: 'D9E1F2' },
        },
        right: {
          style: 'thin',
          color: { argb: 'D9E1F2' },
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

      if (cell.value === 'PASS') {
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

      if (cell.value === 'FAIL') {
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
        cell.value === 'SKIPPED' ||
        cell.value === 'TIMEOUT'
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
// PAYMENT + SECURITY SHEET
// =========================================================

function createPaymentSheet(
  workbook,
  testCases
) {
  const sheet =
    workbook.addWorksheet('Payment');

  sheet.columns = [
    {
      header: 'Test Case ID',
      key: 'id',
      width: 20,
    },
    {
      header: 'Feature',
      key: 'feature',
      width: 14,
    },
    {
      header: 'Scenario',
      key: 'scenario',
      width: 70,
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
      width: 70,
    },
  ];

  for (const test of testCases) {
    sheet.addRow(test);
  }

  styleHeader(sheet.getRow(1));
  styleBody(sheet);
  applyStatusFormatting(sheet);

  sheet.getColumn('F').numFmt = '0.00';

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  sheet.autoFilter = {
    from: 'A1',
    to: 'G1',
  };

  return sheet;
}

// =========================================================
// SUMMARY
// =========================================================

function createSummarySheet(
  workbook,
  testCases
) {
  const sheet =
    workbook.addWorksheet('Summary');

  const total = testCases.length;

  const paymentTests =
    testCases.filter(
      test => test.feature === 'Payment'
    );

  const securityTests =
    testCases.filter(
      test => test.feature === 'Security'
    );

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

  const interrupted = testCases.filter(
    test => test.status === 'INTERRUPTED'
  ).length;

  const paymentPassed =
    paymentTests.filter(
      test => test.status === 'PASS'
    ).length;

  const paymentFailed =
    paymentTests.filter(
      test => test.status === 'FAIL'
    ).length;

  const securityPassed =
    securityTests.filter(
      test => test.status === 'PASS'
    ).length;

  const securityFailed =
    securityTests.filter(
      test => test.status === 'FAIL'
    ).length;

  sheet.mergeCells('A1:B1');

  sheet.getCell('A1').value =
    'HappyPrancer Payment Test Report';

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
    ['Module', 'Payment + Security'],

    [
      'Generated On',
      new Date().toLocaleString(),
    ],

    [],

    ['Metric', 'Count'],

    ['Total Tests', total],

    ['Payment Tests', paymentTests.length],

    ['Security Tests', securityTests.length],

    ['Passed', passed],

    ['Failed', failed],

    ['Skipped', skipped],

    ['Timeout', timeout],

    ['Interrupted', interrupted],

    [],

    ['Payment Passed', paymentPassed],

    ['Payment Failed', paymentFailed],

    ['Security Passed', securityPassed],

    ['Security Failed', securityFailed],
  ]);

  styleHeader(sheet.getRow(5));

  sheet.getColumn('A').width = 28;
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
      `Payment results file not found:\n${resultsPath}\n\n` +
      'Run the payment tests first.'
    );
  }

  const report = JSON.parse(
    fs.readFileSync(
      resultsPath,
      'utf8'
    )
  );

  let testCases =
    extractTests(report);

  testCases =
    removeDuplicates(testCases);

  if (!testCases.length) {
    throw new Error(
      'No Payment or Security test cases were found in payment-results.json.'
    );
  }

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Playwright Payment Automation';

  workbook.created = new Date();

  createSummarySheet(
    workbook,
    testCases
  );

  createPaymentSheet(
    workbook,
    testCases
  );

  const outputFile = path.join(
    outputDirectory,
    'happyprancer-payment-report.xlsx'
  );

  await workbook.xlsx.writeFile(
    outputFile
  );

  const paymentCount =
    testCases.filter(
      test => test.feature === 'Payment'
    ).length;

  const securityCount =
    testCases.filter(
      test => test.feature === 'Security'
    ).length;

  console.log(
    '\nPayment Excel report generated successfully!'
  );

  console.log(
    `Total tests: ${testCases.length}`
  );

  console.log(
    `Payment tests: ${paymentCount}`
  );

  console.log(
    `Security tests: ${securityCount}`
  );

  console.log(
    `Output: ${outputFile}\n`
  );
}

// =========================================================
// RUN
// =========================================================

main().catch(error => {
  console.error(
    '\nFailed to generate Payment Excel report:\n'
  );

  console.error(error);

  process.exit(1);
});