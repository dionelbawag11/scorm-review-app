# SCORM Review App

Welcome to the SCORM Review App project. This application uses Playwright for automated testing of SCORM packages and includes custom QA tooling to review and validate content.

## Setup and Installation

1. Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
2. Open a terminal and navigate to the project directory:
   ```bash
   cd /Users/oniesenpai/desktop/scorm-review-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Install Playwright browsers (if you haven't already):
   ```bash
   npx playwright install
   ```

## How to Run the Project

This project comes with several scripts configured in `package.json` for running tests and QA tools.

### Running Automated Tests

- **Run all standard tests (headless):**
  This runs all Playwright tests while ignoring the boss demo.
  ```bash
  npm run test
  ```

- **Run tests in UI mode:**
  Opens the interactive Playwright UI for exploring, running, and debugging tests.
  ```bash
  npm run test:ui
  ```

- **Run tests in headed mode:**
  Runs tests while opening the actual browser windows so you can watch them execute visually.
  ```bash
  npm run test:headed
  ```

- **Run the Demo for Boss:**
  A special test suite for demonstrations running visually in Chromium.
  ```bash
  npm run demo
  ```

### Running the QA Tool

- **Execute the QA Script:**
  Runs the custom QA tool node script (`qa-tool/qa.js`).
  ```bash
  npm run qa
  ```

## Viewing Progress
Check out [`PROGRESS.md`](./PROGRESS.md) for the current status of the project and our plans for handling additional sample sets of SCORM packages.
