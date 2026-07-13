# scorm-review

Convert SCORM packages into reviewer-ready zip files with the **coreview** annotation tool pre-injected.

## What it does

Takes a SCORM zip or folder, injects `coreview.js` into the HTML entry point, and outputs a new zip that your reviewers can open and annotate — no server, no setup, no browser extension needed.

**Before:** `my-course.zip` — plain SCORM package  
**After:** `my-course_review.zip` — same package with the review/annotation tool added

---

## Requirements

- [Node.js](https://nodejs.org/) version 18 or higher

That's it. No other installs needed.

---

## Installation on a Fresh Computer

### Step 1 — Install Node.js

Go to https://nodejs.org and download the **LTS** version. Run the installer and follow the prompts.

To verify it installed correctly, open a terminal and run:

```bash
node --version
```

You should see something like `v20.x.x`.

### Step 2 — Done

No further setup needed. The tool runs via `npx` which is included with Node.js.

---

## Usage

### Convert a SCORM zip

```bash
npx scorm-review ./my-course.zip
```

Output:

```
Input:  my-course.zip
Output: C:\path\to\my-course_review.zip

Processing SCORM zip... done.

✓ Created: my-course_review.zip (15.2 MB)
```

### Convert a SCORM folder (unzipped package)

```bash
npx scorm-review ./my-course/
```

### Convert a plain HTML file

```bash
npx scorm-review ./page.html
```

### Specify a custom output path

```bash
npx scorm-review ./my-course.zip -o ./output/my-course_review.zip
```

### Show help

```bash
npx scorm-review --help
```

---

## Output explained

| Input type | Output file | What changed |
|---|---|---|
| `.zip` | `<name>_review.zip` | Original zip + `coreview.js` added + script tag injected into `index.html` |
| folder | `<name>_review.zip` | Same folder re-zipped + `coreview.js` added + script tag injected |
| `.html` | `<name>_review.html` | `coreview.js` injected inline |

The output zip has the **exact same structure** as the original — nothing is changed except:
1. `coreview.js` is added next to `index.html`
2. One `<script>` tag is added to `index.html` before `</body>`

---

## Install globally (optional)

If you convert files often, install once and skip the `npx` prefix forever:

```bash
npm install -g scorm-review
```

Then use it from anywhere:

```bash
scorm-review ./my-course.zip
```

---

## How to give it to a reviewer

1. Run `scorm-review` on your SCORM package
2. Send the `_review.zip` file to your reviewer
3. They unzip it and open `index.html` in any browser
4. The annotation panel appears automatically — no install needed on their end

---

## Troubleshooting

**`npx: command not found`**  
Node.js is not installed or not on your PATH. Re-install from https://nodejs.org.

**`Error: No HTML entry point found`**  
The zip doesn't contain an `index.html`. Make sure you're pointing at the correct SCORM package zip.

**`Error: Path not found`**  
The file path you typed doesn't exist. Use the full path or navigate to the folder first.
