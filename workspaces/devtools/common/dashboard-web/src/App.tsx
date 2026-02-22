import { Cpu, ScrollText, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { ConfigsView } from './components/ConfigsView';
import { LogsView } from './components/LogsView';
import { SkillsView } from './components/SkillsView';

type Tab = 'configs' | 'skills' | 'logs';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('configs');

  const tabs: {
    key: Tab;
    label: string;
    icon: React.ReactNode;
    color: string;
    activeClass: string;
  }[] = [
    {
      key: 'configs',
      label: 'Configs',
      icon: <Settings className="w-4 h-4" />,
      color: 'blue',
      activeClass:
        'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    },
    {
      key: 'skills',
      label: 'Agent Skills',
      icon: <Cpu className="w-4 h-4" />,
      color: 'purple',
      activeClass:
        'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
    },
    {
      key: 'logs',
      label: 'Server Logs',
      icon: <ScrollText className="w-4 h-4" />,
      color: 'emerald',
      activeClass:
        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    },
  ];

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
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === tab.key
                      ? `${tab.activeClass} border`
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 max-w-7xl w-full mx-auto relative z-0">
        <div className="h-full w-full animate-in fade-in duration-500 ease-out">
          {activeTab === 'configs' && <ConfigsView />}
          {activeTab === 'skills' && <SkillsView />}
          {activeTab === 'logs' && <LogsView />}
        </div>
      </main>
    </div>
  );
}
