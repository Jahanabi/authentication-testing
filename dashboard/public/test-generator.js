(() => {
  "use strict";
  const GENERATOR_API_URL = "https://test-generator-backend-pi.vercel.app";
  const MAX_FILES = 5;
  const MAX_TOTAL_SIZE = 3 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif"
  ];

  const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/x-png"
  ];


  // =========================
  // ELEMENTS
  // =========================

  const businessLogic =
    document.getElementById("businessLogic");

  const moduleSelect =
    document.getElementById("module");

  const coverageSelect =
    document.getElementById("coverage");

  const caseCountSelect =
    document.getElementById("caseCount");

  const fileInput =
    document.getElementById("fileInput");

  const browseButton =
    document.getElementById("browseButton");

  const dropZone =
    document.getElementById("dropZone");

  const fileList =
    document.getElementById("fileList");

  const generateButton =
    document.getElementById("generateButton");

  const clearButton =
    document.getElementById("clearButton");

  const status =
    document.getElementById("status");

  const resultSection =
    document.getElementById("resultSection");

  const summary =
    document.getElementById("summary");

  const businessRules =
    document.getElementById("businessRules");

  const testCaseBody =
    document.getElementById("testCaseBody");

  const downloadCsv =
    document.getElementById("downloadCsv");


  // =========================
  // STATE
  // =========================

  let selectedFiles = [];
  let latestCases = [];


  // =========================
  // STATUS
  // =========================

  function setStatus(message, type = "") {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = "status";

    if (type) {
      status.classList.add(type);
    }
  }


  // =========================
  // FILE HELPERS
  // =========================

  function getExtension(fileName) {
    return String(fileName || "")
      .split(".")
      .pop()
      .trim()
      .toLowerCase();
  }


  function isAllowedFile(file) {
    if (!file) {
      return false;
    }

    const extension = getExtension(file.name);

    if (ALLOWED_EXTENSIONS.includes(extension)) {
      return true;
    }

    const mimeType =
      String(file.type || "")
        .trim()
        .toLowerCase();

    return ALLOWED_MIME_TYPES.includes(mimeType);
  }


  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }


  function totalFileSize(files) {
    return files.reduce(
      (total, file) => total + file.size,
      0
    );
  }


  // =========================
  // FILE DISPLAY
  // =========================

  function renderFileList() {
    if (!fileList) {
      return;
    }

    fileList.innerHTML = "";

    selectedFiles.forEach((file) => {
      const item = document.createElement("div");

      item.className = "file-item";

      const name = document.createElement("span");

      name.className = "file-name";

      name.textContent = file.name;

      const size = document.createElement("span");

      size.className = "file-size";

      size.textContent = formatFileSize(file.size);

      item.appendChild(name);
      item.appendChild(size);

      fileList.appendChild(item);
    });
  }


  // =========================
  // ADD FILES
  // =========================

  function addFiles(fileListObject) {
    const incomingFiles =
      Array.from(fileListObject || []);

    if (!incomingFiles.length) {
      return;
    }

    const invalidFiles =
      incomingFiles.filter(
        (file) => !isAllowedFile(file)
      );

    if (invalidFiles.length) {
      setStatus(
        `Unsupported file type: ${invalidFiles[0].name}`,
        "error"
      );

      return;
    }


    const combinedFiles = [
      ...selectedFiles,
      ...incomingFiles
    ];


    if (combinedFiles.length > MAX_FILES) {
      setStatus(
        `You can upload a maximum of ${MAX_FILES} files.`,
        "error"
      );

      return;
    }


    const totalSize =
      totalFileSize(combinedFiles);


    if (totalSize > MAX_TOTAL_SIZE) {
      setStatus(
        "The combined file size must be 3 MB or less.",
        "error"
      );

      return;
    }


    selectedFiles = combinedFiles;

    renderFileList();

    setStatus(
      `${selectedFiles.length} file(s) selected.`,
      "success"
    );
  }


  // =========================
  // FILE INPUT
  // =========================

  if (browseButton && fileInput) {
    browseButton.addEventListener(
      "click",
      () => fileInput.click()
    );
  }


  if (fileInput) {
    fileInput.addEventListener(
      "change",
      (event) => {
        addFiles(event.target.files);

        // Allows selecting the same file again later.
        event.target.value = "";
      }
    );
  }


  // =========================
  // DRAG & DROP
  // =========================

  if (dropZone) {

    ["dragenter", "dragover"].forEach(
      (eventName) => {
        dropZone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            dropZone.classList.add("dragover");
          }
        );
      }
    );


    ["dragleave", "drop"].forEach(
      (eventName) => {
        dropZone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            dropZone.classList.remove("dragover");
          }
        );
      }
    );


    dropZone.addEventListener(
      "drop",
      (event) => {
        addFiles(event.dataTransfer.files);
      }
    );

  }


  // =========================
  // FILE → DATA URL
  // =========================

  function fileToData(file) {
    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();

        reader.onload = () => {
          resolve({
            name: file.name,

            mimeType:
              file.type ||
              getMimeTypeFromExtension(
                file.name
              ),

            data: reader.result
          });
        };

        reader.onerror = () => {
          reject(
            new Error(
              `Could not read ${file.name}`
            )
          );
        };

        reader.readAsDataURL(file);
      }
    );
  }


  function getMimeTypeFromExtension(fileName) {
    const extension =
      getExtension(fileName);

    const types = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif"
    };

    return (
      types[extension] ||
      "application/octet-stream"
    );
  }


  // =========================
  // GENERATE
  // =========================

  if (generateButton) {

    generateButton.addEventListener(
      "click",
      async () => {

        const text =
          String(
            businessLogic?.value || ""
          ).trim();


        if (!text && selectedFiles.length === 0) {
          setStatus(
            "Enter business logic or upload at least one file.",
            "error"
          );

          businessLogic?.focus();

          return;
        }


        generateButton.disabled = true;

        setStatus(
          "Preparing input for test case generation...",
          "loading"
        );


        try {

          const files =
            await Promise.all(
              selectedFiles.map(fileToData)
            );


          const requestBody = {
            businessLogic: text,

            module:
              moduleSelect?.value ||
              "general",

            coverage:
              coverageSelect?.value ||
              "general",

            caseCount:
              Number(
                caseCountSelect?.value ||
                10
              ),

            files
          };


          setStatus(
            "Generating test cases...",
            "loading"
          );


          /*
           * This endpoint will be implemented in the
           * backend integration step.
           *
           * Existing Authentication and Payment APIs
           * are NOT used here.
           */

          const response =
            await fetch(
              `${GENERATOR_API_URL}/api/test-generator/generate`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify(
                    requestBody
                  )
              }
            );


          const data =
            await response.json()
              .catch(() => ({}));


          if (!response.ok) {
            throw new Error(
              data.error ||
              "Test case generation failed."
            );
          }


          latestCases =
            Array.isArray(data.testCases)
              ? data.testCases
              : [];


          renderResults(
            data.businessRules || [],
            latestCases
          );


          setStatus(
            `Generated ${latestCases.length} test case(s).`,
            "success"
          );

        } catch (error) {

          console.error(
            "Test case generation error:",
            error
          );


          setStatus(
            error.message ||
            "Unable to generate test cases.",
            "error"
          );

        } finally {

          generateButton.disabled = false;

        }

      }
    );

  }


  // =========================
  // RENDER RESULTS
  // =========================

  function renderResults(
    rules,
    testCases
  ) {

    if (!resultSection) {
      return;
    }


    resultSection.hidden = false;


    if (summary) {
      summary.textContent =
        `${testCases.length} test case(s) generated.`;
    }


    if (businessRules) {

      businessRules.innerHTML = "";

      rules.forEach((rule) => {

        const li =
          document.createElement("li");

        li.textContent =
          typeof rule === "string"
            ? rule
            : rule.description ||
              rule.rule ||
              JSON.stringify(rule);

        businessRules.appendChild(li);

      });

    }


    if (testCaseBody) {

      testCaseBody.innerHTML = "";

      testCases.forEach(
        (testCase, index) => {

          const row =
            document.createElement("tr");


          const values = [
            testCase.id ||
              testCase.testCaseId ||
              `TC-${String(index + 1).padStart(3, "0")}`,

            testCase.feature || "",

            testCase.scenario || "",

            testCase.preconditions || "",

            testCase.objective || "",

            formatSteps(testCase.steps),

            testCase.expectedResult ||
              testCase.expected ||
              "",

            testCase.type || "",

            testCase.priority || ""
          ];


          values.forEach((value) => {

            const cell =
              document.createElement("td");

            cell.textContent =
              value;

            row.appendChild(cell);

          });


          testCaseBody.appendChild(row);

        }
      );

    }

  }


  function formatSteps(steps) {

    if (Array.isArray(steps)) {
      return steps
        .map(
          (step, index) =>
            `${index + 1}. ${step}`
        )
        .join("\n");
    }

    return String(steps || "");
  }


  // =========================
  // CLEAR
  // =========================

  if (clearButton) {

    clearButton.addEventListener(
      "click",
      () => {

        if (businessLogic) {
          businessLogic.value = "";
        }

        selectedFiles = [];
        latestCases = [];

        if (fileInput) {
          fileInput.value = "";
        }

        if (fileList) {
          fileList.innerHTML = "";
        }

        if (testCaseBody) {
          testCaseBody.innerHTML = "";
        }

        if (businessRules) {
          businessRules.innerHTML = "";
        }

        if (resultSection) {
          resultSection.hidden = true;
        }

        if (summary) {
          summary.textContent = "";
        }

        setStatus("");

        if (generateButton) {
          generateButton.disabled = false;
        }

        businessLogic?.focus();

      }
    );

  }


  // =========================
  // CSV EXPORT
  // =========================

  if (downloadCsv) {

    downloadCsv.addEventListener(
      "click",
      () => {

        if (!latestCases.length) {
          setStatus(
            "There are no test cases to export.",
            "error"
          );

          return;
        }


        const headers = [
          "Test Case ID",
          "Feature",
          "Scenario",
          "Preconditions",
          "Objective",
          "Steps",
          "Expected Result",
          "Type",
          "Priority"
        ];


        const rows =
          latestCases.map(
            (testCase, index) => [

              testCase.id ||
                testCase.testCaseId ||
                `TC-${String(index + 1).padStart(3, "0")}`,

              testCase.feature || "",

              testCase.scenario || "",

              testCase.preconditions || "",

              testCase.objective || "",

              formatSteps(testCase.steps),

              testCase.expectedResult ||
                testCase.expected ||
                "",

              testCase.type || "",

              testCase.priority || ""

            ]
          );


        const csv = [
          headers,
          ...rows
        ]
          .map(
            (row) =>
              row
                .map(csvEscape)
                .join(",")
          )
          .join("\r\n");


        const blob =
          new Blob(
            [csv],
            {
              type:
                "text/csv;charset=utf-8;"
            }
          );


        const url =
          URL.createObjectURL(blob);


        const link =
          document.createElement("a");

        link.href = url;

        link.download =
          "generated-test-cases.csv";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

      }
    );

  }


  function csvEscape(value) {

    const text =
      String(value ?? "");

    return `"${text
      .replace(/"/g, '""')
      .replace(/\r?\n/g, " ")
    }"`;

  }

})();