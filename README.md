# 🕵️ UNDRDR — Under the Radar

> **683 open source repos worth watching. All under 1,000 stars at time of discovery.** A living map of hidden gems buried under the noise.

[![Live Graph](https://img.shields.io/badge/Live-Graph-0c8ce9?style=for-the-badge&logo=vercel)](https://akakika.com/undrdr/graph)
[![Website](https://img.shields.io/badge/Website-akakika.com/undrdr-38bdf8?style=for-the-badge&logo=vercel)](https://akakika.com/undrdr/)
[![Repos](https://img.shields.io/badge/Repos-683-green?style=for-the-badge)](https://akakika.com/undrdr/graph)
[![License](https://img.shields.io/badge/License-Private-blue?style=for-the-badge)](LICENSE)

---

## 🌐 Live

**Interactive Graph:** [https://akakika.com/undrdr/graph](https://akakika.com/undrdr/graph)  
**Dashboard:** [https://akakika.com/undrdr/](https://akakika.com/undrdr/)

---

## 💡 The Problem

Most interesting repos are **buried under the noise**.

GitHub has millions of repositories. The good stuff gets lost:
- Hidden by algorithmic feeds
- Drowned out by corporate projects
- Too early for Product Hunt
- Under 1,000 stars (the "invisible threshold")

By the time a repo hits 10k stars, everyone knows about it. **The real gems are found earlier.**

---

## ✨ The Solution

**UNDRDR** is a living map of 683 open source repos — all under 1,000 stars at time of discovery.

- 🔍 **Force-Directed Graph** — Visual network clustered by language
- 🎨 **Heat-Based Coloring** — Boss → Hot → Warm → Cold
- 🔎 **Interactive Exploration** — Zoom, drag, hover for details
- 📊 **Dashboard** — Search, filter, sort for targeted browsing
- ⚡ **Pixi.js Powered** — Smooth performance with 683+ nodes

---

## 🎯 Repo Categories

| Tier | Icon | Description | Stars Range |
|------|------|-------------|-------------|
| **Boss** | 🔥 | Must-watch, potential breakout | 500-999 |
| **Hot** | 🔴 | Fast momentum, high signal | 200-499 |
| **Warm** | 🟡 | Steady growth, worth following | 50-199 |
| **Cold** | 🔵 | Early stage, high potential | <50 |

---

## 🎬 How It Works

### 1️⃣ Discovery
Repos are discovered through:
- GitHub API queries
- Community submissions
- Manual curation
- Trending analysis

### 2️⃣ Categorization
Each repo is tagged by "heat":
- **Boss** — About to breakout
- **Hot** — Gaining momentum fast
- **Warm** — Consistent activity
- **Cold** — Early but promising

### 3️⃣ Visualization
The graph displays:
- **Nodes** = Repositories
- **Node Size** = Relative star count
- **Node Color** = Heat tier
- **Clusters** = Language groups
- **Edges** = Similarity/connections

### 4️⃣ Exploration
- **Zoom** — Scroll to zoom in/out
- **Pan** — Drag to move around
- **Hover** — See repo details
- **Click** — Open GitHub page
- **Search** — Find specific repos

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **🕸️ Force-Directed Graph** | Interactive network visualization with physics simulation |
| **🎨 Heat-Based Coloring** | Visual tier system (Boss/Hot/Warm/Cold) |
| **🔍 Language Clustering** | Repos auto-group by primary language |
| **⚡ Pixi.js Rendering** | GPU-accelerated canvas for smooth performance |
| **📊 Dashboard View** | Traditional list with search and filters |
| **🏷️ Category Filters** | Filter by heat tier |
| **🔎 Search** | Full-text search across all repos |
| **📱 Responsive** | Works on desktop and mobile |

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** — Modern, type-safe UI
- **Vite** — Fast dev server and optimized builds
- **Pixi.js** — High-performance 2D rendering engine
- **D3.js** — Force-directed graph physics
- **Tailwind CSS** — Clean, responsive design
- **GitHub API** — Repo metadata and stats

---

## 📊 Data Structure

### Data Files

| File | Contents | Count |
|------|----------|-------|
| `repos_data.json` | Top 100 repos with full metadata | 100 |
| `all_repos.json` | Complete dataset | 683 |

### Repo Metadata

Each repo includes:
```json
{
  "name": "repo-name",
  "owner": "username",
  "stars": 423,
  "language": "TypeScript",
  "category": "Hot",
  "description": "Short description",
  "url": "https://github.com/...",
  "topics": ["react", "typescript", "..."],
  "lastUpdated": "2026-05-01",
  "createdAt": "2025-12-15"
}
```

---

## 🚀 Quick Start

### Run Locally

```bash
# Clone the repository
git clone https://github.com/dot-RealityTest/undrdr-vis.git
cd undrdr-vis

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3777](http://localhost:3777)

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🎯 Use Cases

### 🔍 Discover Hidden Gems
Find amazing projects before they hit mainstream attention.

### 📊 Market Research
See what's trending in specific tech stacks or categories.

### 🎓 Learning Resources
Discover well-maintained projects to study and learn from.

### 🤝 Community Building
Find and support promising early-stage projects.

### 💼 Hiring & Recruitment
Identify talented developers through their projects.

---

## 🎨 Graph Visualization

### How to Read the Graph

**Node Size:**
- Larger = More stars
- Smaller = Fewer stars

**Node Color:**
- 🔥 **Orange** = Boss tier (500-999 stars)
- 🔴 **Red** = Hot tier (200-499 stars)
- 🟡 **Yellow** = Warm tier (50-199 stars)
- 🔵 **Blue** = Cold tier (<50 stars)

**Clusters:**
- Nodes cluster by language automatically
- JavaScript/TypeScript projects form large clusters
- Niche languages form smaller groups

**Interactions:**
- **Hover** = Show tooltip with stats
- **Click** = Open GitHub repo
- **Drag** = Move individual nodes
- **Scroll** = Zoom in/out
- **Right-click drag** = Pan view

---

## 🙋 FAQ

**Q: How are repos discovered?**  
A: Mix of GitHub API queries, community submissions, manual curation, and trending analysis.

**Q: How often is the data updated?**  
A: Currently updated manually. Auto-refresh planned for future version.

**Q: Can I submit a repo?**  
A: Yes! Submit via GitHub issues or contact @Kika_Loren.

**Q: Why under 1,000 stars?**  
A: That's the "invisible threshold" — repos start gaining mainstream attention after 1k stars.

**Q: Is this list biased toward certain languages?**  
A: Slightly. JavaScript/TypeScript dominate due to popularity, but all languages are represented.

---

## 🔮 Roadmap

- [ ] Auto-refresh data (daily GitHub API sync)
- [ ] User submissions form
- [ ] Advanced filters (by language, date, topics)
- [ ] Email newsletter (weekly hidden gems)
- [ ] API access for developers
- [ ] Export data (CSV, JSON)
- [ ] Comparison view (side-by-side repos)
- [ ] Trending alerts (momentum detection)

---

## 📖 Why This Exists

> "Most interesting repos are buried under the noise."

UNDRDR was built to solve a personal problem: **finding good projects before everyone else does**.

Product Hunt, GitHub Trending, and Twitter all surface the same popular repos. By the time something hits those channels, it's already "discovered."

This is a **living map** — built to surface projects that aren't on Product Hunt yet.

---

## 👨‍💻 Author

**KIKA** — Digital craft and macOS systems

- **Website:** https://akakika.com
- **Twitter:** [@Kika_Loren](https://twitter.com/Kika_Loren)
- **GitHub:** https://github.com/dot-RealityTest

---

## 📄 License

**Private** — All rights reserved to KIKA.

---

## 📊 Stats

- **Total Repos:** 683
- **Boss Tier:** ~50 repos
- **Hot Tier:** ~150 repos
- **Warm Tier:** ~250 repos
- **Cold Tier:** ~233 repos
- **Languages:** 40+
- **Last Updated:** May 2, 2026

---

**Built with ❄️ by KIKA**  
**Last Updated:** May 2, 2026
