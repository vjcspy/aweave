import React, { useState } from 'react';
import { ConfigsView } from './components/ConfigsView';
import { SkillsView } from './components/SkillsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'configs' | 'skills'>('configs');

  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="flex-none border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              DevTools Dashboard
            </h1>
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab('configs')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'configs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                Configs
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'skills' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                Agent Skills
              </button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'configs' ? <ConfigsView /> : <SkillsView />}
      </main>
    </div>
  );
}
