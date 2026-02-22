import { Cpu, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { ConfigsView } from './components/ConfigsView';
import { SkillsView } from './components/SkillsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'configs' | 'skills'>('configs');

  return (
    <div className="flex flex-col h-screen font-sans overflow-hidden">
      {/* Premium Header */}
      <header className="flex-none glass border-b border-white/10 shrink-0 relative z-10 sticky top-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-50 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-100 to-white">
                DevTools Dashboard
              </h1>
            </div>

            <nav className="flex gap-2">
              <button
                onClick={() => setActiveTab('configs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === 'configs'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Settings className="w-4 h-4" />
                Configs
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === 'skills'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Agent Skills
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 max-w-7xl w-full mx-auto relative z-0">
        <div className="h-full w-full animate-in fade-in duration-500 ease-out">
          {activeTab === 'configs' ? <ConfigsView /> : <SkillsView />}
        </div>
      </main>
    </div>
  );
}
