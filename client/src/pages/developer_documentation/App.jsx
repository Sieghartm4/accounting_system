import React, { useState } from 'react'
import { Search, Github, ChevronDown, Book, Zap } from 'lucide-react'
import GettingStarted from './Gettingstarted'
import InteractiveUtilities from './Interactiveutilities'

// ============================================================================
// APP SHELL
// ============================================================================

export default function App() {
  const [activeSection, setActiveSection] = useState('getting-started')
  const [selectedGettingStartedDoc, setSelectedGettingStartedDoc] =
    useState('welcome')
  const [selectedInteractiveTool, setSelectedInteractiveTool] =
    useState('tool-flowchart')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState({
    gettingStarted: false,
    interactive: false,
  })

  // Cross-page navigation handler used by child pages (e.g. welcome page cards)
  const handleNavigate = (section, tool) => {
    setActiveSection(section)
    if (section === 'getting-started' && tool) setSelectedGettingStartedDoc(tool)
    if (section === 'interactive' && tool) setSelectedInteractiveTool(tool)
  }

  const toggleSection = (section) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -30; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>

      {/* ====================================================================
          HEADER
          ==================================================================== */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0b0f19]/95 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-slate-950 font-black shadow-lg shadow-sky-500/10">
            DR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-100 tracking-tight">
                LedgerFlow
              </span>
              <span className="text-xs font-semibold text-sky-400 tracking-wider bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">
                Developer Center
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative hidden md:block w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search endpoints & schemas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500 placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">v1.2.0</span>
            <a
              href="#github"
              className="text-slate-400 hover:text-white transition-colors"
              title="GitHub Docs"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ====================================================================
          PAGE CONTENT WITH SIDEBAR
          ==================================================================== */}
      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800/60 bg-[#0b0f19] flex flex-col shrink-0 overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Getting Started Section */}
            <div className="space-y-3">
              <button
                onClick={() => toggleSection('gettingStarted')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-900/40 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Book size={16} className="text-sky-400" />
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                    Getting Started
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform ${
                    collapsedSections.gettingStarted ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {!collapsedSections.gettingStarted && (
                <nav className="space-y-1 pl-8">
                  <button
                    onClick={() => {
                      setActiveSection('getting-started')
                      handleNavigate('getting-started', 'welcome')
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedGettingStartedDoc === 'welcome'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-400/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    Welcome & Overview
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('getting-started')
                      handleNavigate('getting-started', 'project-structure')
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedGettingStartedDoc === 'project-structure'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-400/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    Project Structure
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('getting-started')
                      handleNavigate('getting-started', 'auth')
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedGettingStartedDoc === 'auth'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-400/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    Authentication & JWT
                  </button>
                </nav>
              )}
            </div>

            {/* Interactive Utilities Section */}
            <div className="space-y-3">
              <button
                onClick={() => toggleSection('interactive')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-900/40 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-pink-400" />
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-pink-400 transition-colors">
                    Interactive Utilities
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform ${
                    collapsedSections.interactive ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {!collapsedSections.interactive && (
                <nav className="space-y-1 pl-8">
                  <button
                    onClick={() => {
                      setActiveSection('interactive')
                      handleNavigate('interactive', 'tool-flowchart')
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedInteractiveTool === 'tool-flowchart'
                        ? 'bg-pink-500/10 text-pink-400 border border-pink-400/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    Flowchart Visualizer
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('interactive')
                      handleNavigate('interactive', 'tool-sandbox')
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedInteractiveTool === 'tool-sandbox'
                        ? 'bg-pink-500/10 text-pink-400 border border-pink-400/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    API Sandbox Playground
                  </button>
                </nav>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-grow overflow-y-auto">
          {activeSection === 'getting-started' && (
            <GettingStarted
              onNavigate={handleNavigate}
              selectedDoc={selectedGettingStartedDoc}
            />
          )}
          {activeSection === 'interactive' && (
            <InteractiveUtilities defaultTool={selectedInteractiveTool} />
          )}
        </div>
      </div>
    </div>
  )
}
