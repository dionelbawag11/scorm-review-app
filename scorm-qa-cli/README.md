# scorm-qa

Automated QA tool for SCORM packages. Opens the module in a real browser, runs 7 checks, and generates a detailed bug report with screenshots.

## What it does

Points at a SCORM zip or folder, launches a headless Chromium browser, exercises the module, and saves an HTML bug report next to your input file.

**Example report includes:**
- Total bugs found with severity (Critical / High / Medium)
- Screenshots of each bug
- Steps to reproduce
- SCORM API call log (LMSInitialize, SetValue, etc.)
- Navigation test results

---

## Requirements

- [Node.js](https://nodejs.org/) version 18 or higher

Chromium browser is downloaded automatically on first install (~136 MB). No manual browser install needed.

---

## Installation on a Fresh Computer

### Step 1 — Install Node.js

Go to https://nodejs.org and download the **LTS** version. Run the installer and follow the prompts.

To verify:

```bash
node --version
```

You should see `v20.x.x` or higher.

### Step 2 — Install scorm-qa globally

```bash
npm install -g scorm-qa
```

This will:
- Install the tool
- Automatically download Chromium (~136 MB, one time only)

### Step 3 — Done

---

## Usage

### QA a SCORM folder

```bash
scorm-qa ./my-course/
```

### QA a SCORM zip

```bash
scorm-qa ./my-course.zip
```

### Using npx (no install needed)

```bash
npx scorm-qa ./my-course.zip
```

> **Note:** First run with `npx` will download Chromium automatically. This takes a minute but only happens once.

### Show help

```bash
scorm-qa --help
```

---

## What it checks

| # | Check | What it looks for |
|---|---|---|
| 1 | **Module loads** | Page finishes loading within 20 seconds |
| 2 | **Page title** | `<title>` tag is not empty |
| 3 | **SCORM API** | `LMSInitialize` is called on load |
| 4 | **JavaScript errors** | No errors in the browser console |
| 5 | **Broken images** | All images load (bundled and external) |
| 6 | **Navigation** | Next button advances the page counter |
| 7 | **SCORM completion** | `cmi.core.lesson_status` is reported |

---

## Output

After the run you get two things saved next to your input file:

```
QA-Report-my-course-2026-07-13.html   ← open this in your browser
_qa_screenshots/                        ← screenshot folder
  01-landing.png
  04-js-error.png       ← only if a bug was found
  05-broken-images.png  ← only if a bug was found
  07-final.png
```

The HTML report opens automatically in your browser when the scan finishes.

---

## Example output in terminal

```
🔍 SCORM QA Tool
   Input:    C:\courses\my-course.zip
   Serving:  C:\courses\my-course_qa_tmp\scorm_package
   URL:      http://localhost:18765
   Starting browser...

  [1/7] Loading module... ✅ PASS
  [2/7] Checking title... ✅ PASS — Introduction to Safety
  [3/7] Checking SCORM API... ✅ PASS
  [4/7] Checking for JS errors... ❌ FAIL — 1 error(s)
  [5/7] Checking images... ❌ FAIL — 0 bundled broken, 3 external broken
  [6/7] Checking navigation... ✅ PASS — 02/10 → 04/10
  [7/7] Checking SCORM completion status... ✅ PASS — status: passed | score: 100

📄 Building report...

✅ Done!
   Bugs found:    2
   Checks passed: 5
   Report:        C:\courses\QA-Report-my-course-2026-07-13.html
```

---

## Severity levels

| Level | Meaning |
|---|---|
| **Critical** | Module is broken or uncompletable — do not publish |
| **High** | Serious issue affecting content or scoring |
| **Medium** | Minor issue, still worth fixing before publish |
| **Low** | Cosmetic or informational |

---

## Troubleshooting

**Chromium download fails on install**  
Run manually after install:
```bash
npx playwright install chromium
```

**`Error: Path not found`**  
The file or folder path you typed doesn't exist. Check the path and try again.

**`Error: No HTML entry point found`**  
The zip doesn't contain an `index.html`. Point directly at the folder inside the zip that contains `index.html`, or check that your SCORM package is structured correctly.

**Port 18765 already in use**  
Another process is using that port. Close it or restart your terminal and try again.

**Report opens but screenshots are missing**  
Screenshots are saved in a `_qa_screenshots/` folder next to your input. The report embeds them as base64 — if the folder was deleted before the report was opened, they won't show.
