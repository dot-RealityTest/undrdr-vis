import { useState } from 'react'
import GraphCanvas from './components/GraphCanvas'
import Tooltip from './components/Tooltip'
import Legend from './components/Legend'
import { type Repo } from './types'

// Demo data until we wire the API
const DEMO_REPOS: Repo[] = [
  { url: 'https://github.com/Arthur-Ficial/apfel', name: 'apfel', description: 'The free AI already on your Mac. On-device Apple FoundationModels CLI + OpenAI-compatible server.', why: '', stars: 387, lang: 'Swift', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/Arthur-Ficial/apfel-chat', name: 'apfel-chat', description: 'Multi-conversation macOS chat client. Streaming markdown, speech I/O, 100% on-device.', why: '', stars: 42, lang: 'Swift', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/Arthur-Ficial/apfel-clip', name: 'apfel-clip', description: 'AI clipboard actions from the macOS menu bar. Summarize, translate, rewrite.', why: '', stars: 28, lang: 'Swift', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/Arthur-Ficial/apfel-quick', name: 'apfel-quick', description: 'Instant AI overlay for macOS. Press a key, ask anything, get an on-device answer.', why: '', stars: 19, lang: 'Swift', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/Arthur-Ficial/apfelpad', name: 'apfelpad', description: 'A formula notepad for thinking. On-device AI as a first-class function you can call inline.', why: '', stars: 15, lang: 'Swift', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/Arthur-Ficial/apfel-mcp', name: 'apfel-mcp', description: 'Token-budget-optimized MCP servers for apfel. url-fetch, ddg-search, search-and-fetch.', why: '', stars: 31, lang: 'Python', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/Arthur-Ficial/apfel-gui', name: 'apfel-gui', description: 'Native SwiftUI debug inspector for apfel. Request timeline, MCP protocol viewer, chat.', why: '', stars: 12, lang: 'Swift', temperature: 'cold', temperatures: ['cold'] },
  { url: 'https://github.com/Lethe044/hermes-skill-marketplace', name: 'hermes-skill-marketplace', description: 'Self-evolving Hermes agent that writes, tests, and publishes reusable Skills autonomously.', why: '', stars: 4, lang: 'Python', temperature: 'cold', temperatures: ['cold'] },
  { url: 'https://github.com/sharkdp/fd', name: 'fd', description: 'A simple, fast and user-friendly alternative to find.', why: '', stars: 3456, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/astral-sh/uv', name: 'uv', description: 'An extremely fast Python package and project manager, written in Rust.', why: '', stars: 4567, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/zsh-users/zsh-syntax-highlighting', name: 'zsh-syntax-highlighting', description: 'Fish shell-like syntax highlighting for Zsh.', why: '', stars: 890, lang: 'Shell', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/python-cmd2/cmd2', name: 'cmd2', description: 'A tool for building command line interactive apps.', why: '', stars: 684, lang: 'Python', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/charmbracelet/bubbletea', name: 'bubbletea', description: 'A powerful little TUI framework for Go.', why: '', stars: 29876, lang: 'Go', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/typst/typst', name: 'typst', description: 'A markup-based typesetting system.', why: '', stars: 35421, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/denoland/deno', name: 'deno', description: 'A modern runtime for JavaScript and TypeScript.', why: '', stars: 98765, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/Schniz/fnm', name: 'fnm', description: 'Fast and simple Node.js version manager.', why: '', stars: 17999, lang: 'Rust', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/ajeetdsouza/zoxide', name: 'zoxide', description: 'Smarter cd command, inspired by z.', why: '', stars: 8234, lang: 'Rust', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/BurntSushi/ripgrep', name: 'ripgrep', description: 'Recursively searches directories for a regex pattern.', why: '', stars: 52999, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/Wilfred/difftastic', name: 'difftastic', description: 'A structural diff that understands syntax.', why: '', stars: 21199, lang: 'Rust', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/imsnif/bandwhich', name: 'bandwhich', description: 'Terminal bandwidth utilization tool.', why: '', stars: 9786, lang: 'Rust', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/nushell/nushell', name: 'nushell', description: 'A new type of shell.', why: '', stars: 32100, lang: 'Rust', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/fastapi/fastapi', name: 'fastapi', description: 'Modern fast web framework for building APIs with Python.', why: '', stars: 82100, lang: 'Python', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/pallets/flask', name: 'flask', description: 'The Python micro framework for building web applications.', why: '', stars: 68500, lang: 'Python', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/home-assistant/core', name: 'home-assistant', description: 'Open source home automation that puts local control and privacy first.', why: '', stars: 75600, lang: 'Python', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/obsidianmd/obsidian-api', name: 'obsidian-api', description: 'API for Obsidian plugins.', why: '', stars: 1200, lang: 'TypeScript', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/floatingpip/ComfyUI', name: 'ComfyUI', description: 'The most powerful and modular stable diffusion GUI and backend.', why: '', stars: 72100, lang: 'Python', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/tldraw/tldraw', name: 'tldraw', description: 'A very good whiteboard app.', why: '', stars: 43200, lang: 'TypeScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/n8n-io/n8n', name: 'n8n', description: 'Workflow automation for technical folks.', why: '', stars: 67800, lang: 'TypeScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/ollama/ollama', name: 'ollama', description: 'Get up and running with Llama 3, Mistral, and other LLMs locally.', why: '', stars: 138000, lang: 'Go', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/open-webui/open-webui', name: 'open-webui', description: 'User-friendly AI frontend for Ollama. Self-hosted, offline-capable.', why: '', stars: 88000, lang: 'Svelte', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/ggml-org/llama.cpp', name: 'llama.cpp', description: 'LLM inference in C/C++. The original.', why: '', stars: 76100, lang: 'C++', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/vercel/next.js', name: 'next.js', description: 'The React Framework for the Web.', why: '', stars: 131000, lang: 'JavaScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/vitejs/vite', name: 'vite', description: 'Next generation frontend tooling.', why: '', stars: 72400, lang: 'TypeScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/sveltejs/svelte', name: 'svelte', description: 'Cybernetically enhanced web apps.', why: '', stars: 81900, lang: 'JavaScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/tailwindlabs/tailwindcss', name: 'tailwindcss', description: 'A utility-first CSS framework for rapid UI development.', why: '', stars: 86900, lang: 'TypeScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/pmndrs/zustand', name: 'zustand', description: 'Bear necessities for state management in React.', why: '', stars: 50500, lang: 'TypeScript', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/tanstack/query', name: 'tanstack-query', description: 'Powerful asynchronous state management for JS.', why: '', stars: 43500, lang: 'TypeScript', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/pmndrs/react-spring', name: 'react-spring', description: 'Spring-physics based animation library for React.', why: '', stars: 29100, lang: 'TypeScript', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/framer/motion', name: 'motion', description: 'Open source, production-ready animation library for React.', why: '', stars: 26700, lang: 'TypeScript', temperature: 'hot', temperatures: ['hot'] },
  { url: 'https://github.com/radix-ui/primitives', name: 'radix-ui', description: 'Radix Primitives — unstyled, accessible components for React.', why: '', stars: 15800, lang: 'TypeScript', temperature: 'warm', temperatures: ['warm'] },
  { url: 'https://github.com/supabase/supabase', name: 'supabase', description: 'The open source Firebase alternative.', why: '', stars: 81200, lang: 'TypeScript', temperature: 'boss', temperatures: ['boss'] },
  { url: 'https://github.com/neo4j/neo4j', name: 'neo4j', description: 'Graphs for Everyone — the world\'s leading graph database.', why: '', stars: 13600, lang: 'Java', temperature: 'warm', temperatures: ['warm'] },
]

function App() {
  const [repos] = useState<Repo[]>(DEMO_REPOS)
  const [highlightedTemp, setHighlightedTemp] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredRepo, setHoveredRepo] = useState<Repo | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Group repos by language for clustering
  const languageGroups: Record<string, Repo[]> = {}
  for (const repo of repos) {
    const lang = repo.lang || 'unknown'
    if (!languageGroups[lang]) languageGroups[lang] = []
    languageGroups[lang].push(repo)
  }

  const handleHover = (repo: Repo | null) => {
    setHoveredRepo(repo)
    if (repo) {
      setTooltipPos({ x: mousePos.x, y: mousePos.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (hoveredRepo) {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  const tempCounts = {
    boss: repos.filter(r => r.temperature === 'boss').length,
    hot: repos.filter(r => r.temperature === 'hot').length,
    warm: repos.filter(r => r.temperature === 'warm').length,
    cold: repos.filter(r => r.temperature === 'cold').length,
  }

  return (
    <div className="app" onMouseMove={handleMouseMove}>
      <div className="header">
        <div className="logo">UNDR<span>DR</span></div>
        <div className="stats">
          <span><span className="stat-value">{repos.length}</span> repos</span>
          <span><span className="stat-value">{Object.keys(languageGroups).length}</span> languages</span>
          <span><span className="stat-value">{tempCounts.boss}</span> boss</span>
          <span><span className="stat-value">{tempCounts.hot}</span> hot</span>
        </div>
      </div>

      <div className="search-container">
        <span className="search-icon">⌕</span>
        <input
          className="search-input"
          type="text"
          placeholder="Search repos, languages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <Legend
        repos={repos}
        highlightedTemp={highlightedTemp}
        onHighlight={setHighlightedTemp}
      />

      <GraphCanvas
        repos={repos}
        languageGroups={languageGroups}
        highlightedTemp={highlightedTemp}
        searchQuery={searchQuery}
        onSelectRepo={setSelectedRepo}
        hoveredRepo={hoveredRepo}
        onHoverRepo={handleHover}
      />

      <Tooltip
        repo={hoveredRepo}
        x={tooltipPos.x}
        y={tooltipPos.y}
      />

      {selectedRepo && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 100,
          background: '#16162580',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 16,
          padding: 20,
          maxWidth: 300,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedRepo.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'JetBrains Mono' }}>
                {selectedRepo.url.replace('https://github.com/', '')}
              </div>
            </div>
            <button
              onClick={() => setSelectedRepo(null)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
            >
              ×
            </button>
          </div>
          {selectedRepo.description && (
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
              {selectedRepo.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, fontFamily: 'JetBrains Mono' }}>
            <span style={{ color: '#f59e0b' }}>★ {selectedRepo.stars >= 1000 ? `${(selectedRepo.stars/1000).toFixed(1)}k` : selectedRepo.stars}</span>
            <span style={{ color: '#3b82f6' }}>{selectedRepo.lang}</span>
            <span style={{ color: getTempColor(selectedRepo.temperature), textTransform: 'uppercase', fontWeight: 600 }}>
              {selectedRepo.temperature}
            </span>
          </div>
          <a
            href={selectedRepo.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 12, color: '#10b981', fontSize: 12, textDecoration: 'none', fontFamily: 'JetBrains Mono' }}
          >
            Open on GitHub →
          </a>
        </div>
      )}
    </div>
  )
}

function getTempColor(temp: string): string {
  const colors: Record<string, string> = {
    boss: '#f59e0b',
    hot: '#10b981',
    warm: '#3b82f6',
    cold: '#475569',
  }
  return colors[temp] || colors.cold
}

export default App