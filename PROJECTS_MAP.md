# undrdr-vis

This folder, `undrdr-vis`, appears to be a frontend visualization project designed to display curated data about 'Under the Radar' AI repositories from GitHub.

## Purpose

- Visualize a collection of AI/ML GitHub repositories.
- Provide an interactive dashboard for exploring 'hidden gem' projects.
- Use data compiled from sources like `all_repos.json` and `repos_data.json`.

## Key Observations

- The README specifies a collection of 683 GitHub AI repositories, focusing on those under 1,000 stars.
- Key data files include `all_repos.json` (complete dataset) and `repos_data.json` (top repositories).
- The application uses React and Pixi.js (visible in `package-lock.json` dependencies).
- Setup and development are managed using Vite, indicated by `vite.config.ts` and scripts in `package.json`.
- The dashboard functionality is expected to be served by `dashboard.html` and `index.html`.

## Top-Level Contents

- `all_repos.json`: JSON data or configuration file.
- `dashboard.html`: Top-level file.
- `dist`: Folder containing project files or grouped materials.
- `eslint.config.js`: Top-level file.
- `index.html`: Top-level file.
- `node_modules`: Folder containing project files or grouped materials.
- `package-lock.json`: JSON data or configuration file.
- `package.json`: JSON data or configuration file.
- `public`: Folder containing project files or grouped materials.
- `README.md`: Markdown document (likely notes, documentation, or a generated map file).
- `repos_data.json`: JSON data or configuration file.
- `src`: Folder containing project files or grouped materials.
- `tsconfig.app.json`: JSON data or configuration file.
- `tsconfig.json`: JSON data or configuration file.
- `tsconfig.node.json`: JSON data or configuration file.
- `vite.config.ts`: Top-level file.

## Grouped Contents

Below is a high-level grouping of the contents, based on naming and file types:

- **Project folders**: `dist`, `node_modules`, `public`, `src`
- **Docs / notes**: `README.md`
- **Configs / data**: `all_repos.json`, `package-lock.json`, `package.json`, `repos_data.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`
- **Files**: `dashboard.html`, `eslint.config.js`, `index.html`, `vite.config.ts`

## Quick Start Suggestions

- Run `npm install` to install necessary dependencies defined in `package.json`.
- Start the development server using the script: `npm run dev`.
- Inspect the data source files (`all_repos.json` or `repos_data.json`) to understand the repository metadata structure.
- Review `src/` files to see the React components responsible for rendering the dashboard visualization.

## Summary Statistics

- **Total Files**: 25
- **Total Folders**: 4
- **Total Size**: 1.3 MB
- **Skipped Directories**: Some large or irrelevant directories (e.g., `node_modules`, `.git`) were skipped.

## Common File Types

Here are the most common file extensions in this directory:

| Extension | Count |
|-----------|-------|
| `json` | 7 |
| `tsx` | 5 |
| `svg` | 4 |
| `css` | 2 |
| `html` | 2 |
| `ts` | 2 |
| `js` | 1 |
| `md` | 1 |
| `png` | 1 |

## Directory Structure Preview

Below is a preview of the directory structure (up to 30 levels deep):

```text
undrdr-vis
├─ public
│  ├─ favicon.svg
│  └─ icons.svg
├─ src
│  ├─ assets
│  │  ├─ hero.png
│  │  ├─ react.svg
│  │  └─ vite.svg
│  ├─ components
│  │  ├─ GraphCanvas.tsx
│  │  ├─ Legend.tsx
│  │  └─ Tooltip.tsx
│  ├─ App.css
│  ├─ App.tsx
│  ├─ index.css
│  ├─ main.tsx
│  └─ types.ts
├─ all_repos.json
├─ dashboard.html
├─ eslint.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ README.md
├─ repos_data.json
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts
```

> _Note: This preview is truncated for readability. For a full view, browse the directory directly._