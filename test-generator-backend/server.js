const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3001);

const MODEL =
  process.env.TEST_GENERATOR_MODEL ||
  "gemini-3.5-flash-lite";

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN ||
  "http://localhost:3000";

const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 3 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);


/* ============================================================
   CORS
============================================================ */

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED_ORIGIN
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});


/* ============================================================
   JSON BODY
============================================================ */

app.use(
  express.json({
    limit: "6mb",
  })
);


/* ============================================================
   HEALTH
============================================================ */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "test-generator-backend",
    model: MODEL,
  });
});


/* ============================================================
   CONSTANTS
============================================================ */

const MODULE_LABELS = {
  authentication: "Authentication",
  payment: "Payment",
  subscription: "Subscription",
  general: "General",
};

const COVERAGE_LABELS = {
  general: "General",
  functional: "Functional Only",
  comprehensive: "Comprehensive",
  "functional-security":
    "Functional + Security",
};

const ALLOWED_CASE_COUNTS = new Set([
  10,
  20,
  30,
  50,
  75,
  100,
  150,
  200,
]);


/* ============================================================
   NORMALIZATION
============================================================ */

function normalizeModule(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return MODULE_LABELS[key]
    ? key
    : "general";
}


function normalizeCoverage(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return COVERAGE_LABELS[key]
    ? key
    : "general";
}


/* ============================================================
   MODULE INSTRUCTIONS
============================================================ */

function getModuleInstructions(moduleKey) {
  switch (moduleKey) {

    case "authentication":
      return `
Focus ONLY on Authentication.

Relevant areas:
- Login
- Signup / Registration
- Email
- Password
- Required fields
- Validation
- Authentication errors
- Session behavior
- Account state

Do not create unrelated Payment or Subscription cases.
`;

    case "payment":
      return `
Focus ONLY on Payment.

Relevant areas:
- Payment initiation
- Payment form
- Amount
- Currency
- Payment validation
- Successful payment
- Failed payment
- Duplicate payment
- Retry
- Cancellation
- Payment confirmation
- Billing history when relevant

Do not create unrelated Authentication or Subscription cases.
`;

    case "subscription":
      return `
Focus ONLY on Subscription.

Relevant areas:
- Plan selection
- Monthly plans
- Yearly plans
- Subscribe
- Upgrade
- Downgrade
- Renewal
- Cancellation
- Pause
- Resume
- Subscription state
- Billing and renewal rules

Do not create unrelated Authentication or Payment cases.
`;

    default:
      return `
Focus only on the functionality described by the
provided business logic.

Do not invent unrelated features.
`;
  }
}


/* ============================================================
   COVERAGE INSTRUCTIONS
============================================================ */

function getCoverageInstructions(coverageKey) {

  switch (coverageKey) {

    case "functional":

      return `
FUNCTIONAL ONLY.

Include:
- Positive scenarios
- Negative scenarios
- Required-field validation
- Input validation
- Boundary cases
- Business rules
- Error handling
- State changes
- Main workflows

Do NOT include:
- SQL injection
- XSS
- CSRF
- Penetration testing
- Security attacks
- Performance testing

unless explicitly required by the supplied business logic.
`;

    case "comprehensive":

      return `
COMPREHENSIVE COVERAGE.

Include relevant:
- Positive scenarios
- Negative scenarios
- Validation
- Boundary cases
- Business rules
- Error handling
- State transitions
- Data consistency
- Permissions
- Security
- Edge cases
- Failure and recovery
`;

    case "functional-security":

      return `
FUNCTIONAL + SECURITY.

Include functional scenarios plus relevant:
- Authentication security
- Authorization
- Session security
- Injection
- XSS
- CSRF
- Sensitive data exposure
- Duplicate request abuse
- Security-related negative cases
`;

    default:

      return `
GENERAL COVERAGE.

Focus on:
- Main workflow
- Important positive scenarios
- Important negative scenarios
- Basic validation
- Important business rules
- Important edge cases

Do not generate a large penetration/security suite.
`;
  }
}


/* ============================================================
   JSON CLEANUP
============================================================ */

function cleanJsonText(text) {

  let value =
    String(text || "").trim();

  if (value.startsWith("```")) {

    value =
      value.replace(
        /^```(?:json)?\s*/i,
        ""
      );

    value =
      value.replace(
        /\s*```$/i,
        ""
      );
  }

  const firstBrace =
    value.indexOf("{");

  const lastBrace =
    value.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    value =
      value.slice(
        firstBrace,
        lastBrace + 1
      );
  }

  return value;
}


/* ============================================================
   TEST CASE NORMALIZATION
============================================================ */

function normalizeTestCase(item, index) {

  const source =
    item &&
    typeof item === "object"
      ? item
      : {};

  const value = (
    key,
    fallback = ""
  ) => {

    const result =
      source[key];

    if (
      result === undefined ||
      result === null
    ) {
      return fallback;
    }

    if (Array.isArray(result)) {
      return result.join("; ");
    }

    return String(result);
  };


  return {

    id:
      `TC-${String(index + 1).padStart(3, "0")}`,

    feature:
      value(
        "feature",
        "Business Logic"
      ),

    scenario:
      value(
        "scenario",
        "Generated test scenario"
      ),

    preconditions:
      value(
        "preconditions",
        "Application is available"
      ),

    objective:
      value(
        "objective",
        "Validate the specified business behavior"
      ),

    steps:
      value(
        "steps",
        "Execute the described workflow"
      ),

    expectedResult:
      value(
        "expectedResult",
        value(
          "expected",
          "Expected business behavior is achieved"
        )
      ),

    actualResult:
      value(
        "actualResult",
        ""
      ),

    status:
      value(
        "status",
        "Not Executed"
      ),

    type:
      value(
        "type",
        "Functional"
      ),

    priority:
      value(
        "priority",
        "Medium"
      ),
  };
}


/* ============================================================
   REMOVE DUPLICATES
============================================================ */

function removeDuplicates(testCases) {

  const seen = new Set();

  const result = [];

  for (const testCase of testCases) {

    const key = [
      testCase.feature,
      testCase.scenario,
      testCase.objective,
      testCase.expectedResult,
    ]
      .join("|")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!seen.has(key)) {

      seen.add(key);

      result.push(testCase);
    }
  }

  return result;
}


/* ============================================================
   PROMPT
============================================================ */

function buildPrompt({
  businessLogic,
  moduleKey,
  coverageKey,
  caseCount,
}) {

  return `
You are a professional Software QA engineer
and expert test-case designer.

Your task is to convert business logic into
high-quality structured software test cases.

MODULE:
${MODULE_LABELS[moduleKey]}

COVERAGE:
${COVERAGE_LABELS[coverageKey]}

TARGET:
${caseCount} test cases maximum.

IMPORTANT COUNT RULE:

The requested number is a maximum/target.

Do NOT invent meaningless cases simply to reach
the requested number.

If the supplied business logic supports only
17 meaningful scenarios and the user selected
50, return approximately 17 meaningful cases.

Never duplicate scenarios.

MODULE RULES:

${getModuleInstructions(moduleKey)}

COVERAGE RULES:

${getCoverageInstructions(coverageKey)}

BUSINESS LOGIC:

${businessLogic || "(Business logic is contained in uploaded files.)"}

OUTPUT:

Return ONLY valid JSON.

Use exactly:

{
  "businessRules": [
    "Rule 1",
    "Rule 2"
  ],
  "testCases": [
    {
      "feature": "Feature",
      "scenario": "Scenario",
      "preconditions": "Preconditions",
      "objective": "Objective",
      "steps": "1. Step one\\n2. Step two",
      "expectedResult": "Expected result",
      "actualResult": "",
      "status": "Not Executed",
      "type": "Functional",
      "priority": "High"
    }
  ]
}

QUALITY RULES:

1. Every case must be traceable to the supplied business logic.
2. Do not invent unrelated features.
3. Avoid duplicate scenarios.
4. Use professional QA terminology.
5. Include clear steps.
6. Include a specific expected result.
7. Choose appropriate priority.
8. Respect the selected module.
9. Respect the selected coverage.
`;
}


/* ============================================================
   GEMINI
============================================================ */

async function generateWithGemini({
  businessLogic,
  moduleKey,
  coverageKey,
  caseCount,
  files,
}) {

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }


  const parts = [
    {
      text: buildPrompt({
        businessLogic,
        moduleKey,
        coverageKey,
        caseCount,
      }),
    },
  ];


  /* ----------------------------------------------------------
     Uploaded PDF / IMAGE files
  ---------------------------------------------------------- */

  for (const file of files) {

    if (!file) {
      continue;
    }

    const dataUrl =
      String(
        file.data ||
        file.dataUrl ||
        ""
      );

    if (!dataUrl) {
      continue;
    }


    const match =
      dataUrl.match(
        /^data:([^;]+);base64,(.+)$/s
      );


    if (!match) {
      continue;
    }


    const mimeType =
      String(
        file.mimeType ||
        match[1] ||
        ""
      ).toLowerCase();


    const base64Data =
      match[2];


    if (
      !ALLOWED_MIME_TYPES.has(
        mimeType
      )
    ) {
      continue;
    }


    parts.push({

      inlineData: {

        mimeType,

        data:
          base64Data,
      },

    });
  }


  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(MODEL)}` +
    `:generateContent`;


  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey,
        },

        body:
          JSON.stringify({

            contents: [
              {
                role: "user",

                parts,
              },
            ],

            generationConfig: {

              temperature: 0.2,

              responseMimeType:
                "application/json",
            },

          }),
      }
    );


  const rawText =
    await response.text();


  if (!response.ok) {

    let message =
      rawText;

    try {

      const errorBody =
        JSON.parse(rawText);

      message =
        errorBody?.error?.message ||
        errorBody?.message ||
        rawText;

    } catch {
      // Keep original response.
    }


    throw new Error(
      `Gemini API error (${response.status}): ${message}`
    );
  }


  let responseBody;

  try {

    responseBody =
      JSON.parse(rawText);

  } catch {

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }


  const generatedText =
    responseBody
      ?.candidates?.[0]
      ?.content?.parts
      ?.map(
        part =>
          part.text || ""
      )
      .join("")
      .trim();


  if (!generatedText) {

    throw new Error(
      "Gemini returned no generated test cases."
    );
  }


  let result;

  try {

    result =
      JSON.parse(
        cleanJsonText(
          generatedText
        )
      );

  } catch {

    throw new Error(
      "Gemini returned malformed test-case JSON."
    );
  }


  const businessRules =
    Array.isArray(
      result.businessRules
    )
      ? result.businessRules.map(String)
      : [];


  let testCases =
    Array.isArray(
      result.testCases
    )
      ? result.testCases.map(
          normalizeTestCase
        )
      : [];


  testCases =
    removeDuplicates(
      testCases
    );


  testCases =
    testCases
      .slice(0, caseCount)
      .map(
        (testCase, index) => ({
          ...testCase,

          id:
            `TC-${String(
              index + 1
            ).padStart(3, "0")}`,
        })
      );


  return {

    businessRules,

    testCases,

    summary: {

      requested:
        caseCount,

      generated:
        testCases.length,

      module:
        MODULE_LABELS[
          moduleKey
        ],

      coverage:
        COVERAGE_LABELS[
          coverageKey
        ],
    },

  };
}


/* ============================================================
   GENERATE ENDPOINT
============================================================ */

app.post(
  "/api/test-generator/generate",
  async (req, res) => {

    try {

      const body =
        req.body || {};


      const businessLogic =
        String(
          body.businessLogic ||
          ""
        ).trim();


      const moduleKey =
        normalizeModule(
          body.module
        );


      const coverageKey =
        normalizeCoverage(
          body.coverage
        );


      const caseCount =
        Number(
          body.caseCount
        );


      const files =
        Array.isArray(
          body.files
        )
          ? body.files.slice(
              0,
              MAX_FILES
            )
          : [];


      if (
        !businessLogic &&
        files.length === 0
      ) {

        res.status(400).json({
          error:
            "Enter business logic or upload a PDF/image.",
        });

        return;
      }


      if (
        !ALLOWED_CASE_COUNTS.has(
          caseCount
        )
      ) {

        res.status(400).json({
          error:
            "Invalid number of test cases.",
        });

        return;
      }


      const totalSize =
        files.reduce(
          (
            total,
            file
          ) =>
            total +
            Number(
              file?.size ||
              0
            ),
          0
        );


      if (
        totalSize >
        MAX_TOTAL_SIZE
      ) {

        res.status(400).json({
          error:
            "Uploaded files must be 3 MB or less in total.",
        });

        return;
      }


      const result =
        await generateWithGemini({

          businessLogic,

          moduleKey,

          coverageKey,

          caseCount,

          files,
        });


      res.json({

        ok: true,

        ...result,

      });

    } catch (error) {

      console.error(
        "Test Generator error:",
        error
      );


      res.status(500).json({

        error:
          error?.message ||
          "Unable to generate test cases.",

      });
    }
  }
);


/* ============================================================
   START
============================================================ */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Test Generator Backend running on http://localhost:${PORT}`
    );
  });
}

module.exports = app;