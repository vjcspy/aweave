import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  ScrollText,
  Settings,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';

import { ConfigsView } from './components/ConfigsView';
import { LogsView } from './components/LogsView';
import { SkillsView } from './components/SkillsView';

type Tab = 'configs' | 'skills' | 'logs';

const tabs: {
  key: Tab;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    key: 'configs',
    label: 'Configs',
    icon: <Settings className="w-[18px] h-[18px]" />,
    color: 'blue',
  },
  {
    key: 'skills',
    label: 'Agent Skills',
    icon: <Cpu className="w-[18px] h-[18px]" />,
    color: 'purple',
  },
  {
    key: 'logs',
    label: 'Server Logs',
    icon: <ScrollText className="w-[18px] h-[18px]" />,
    color: 'emerald',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('configs');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen font-sans overflow-hidden relative z-10">
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col shrink-0 glass border-r border-white/[0.06] relative transition-all duration-300 ease-in-out"
        style={{ width: sidebarCollapsed ? 68 : 220 }}
      >
        {/* Subtle gradient line on the right edge */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/20 via-purple-500/10 to-transparent" />

        {/* Brand */}
        <div
          className={`pt-6 pb-8 transition-all duration-300 ${sidebarCollapsed ? 'px-0 flex justify-center' : 'px-5'}`}
        >
          <div
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 relative shrink-0">
              <Zap
                className="w-[18px] h-[18px] text-white"
                strokeWidth={2.5}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-[15px] font-bold tracking-tight text-white whitespace-nowrap">
                  DevTools
                </h1>
                <p className="text-[11px] text-zinc-500 font-medium tracking-wide whitespace-nowrap">
                  Dashboard
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 flex flex-col gap-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-color={tab.color}
              className={`sidebar-item ${activeTab === tab.key ? 'active' : ''} ${sidebarCollapsed ? 'justify-center !px-0 !gap-0' : ''}`}
              title={sidebarCollapsed ? tab.label : undefined}
            >
              <span className="shrink-0">{tab.icon}</span>
              {!sidebarCollapsed && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom: collapse toggle + status */}
        <div className="border-t border-white/[0.04]">
          {/* Collapse/Expand button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-2 py-3 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all duration-200 ${sidebarCollapsed ? 'px-0 justify-center' : 'px-5'}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px] font-medium">Collapse</span>
              </>
            )}
          </button>

          {/* Status */}
          <div
            className={`py-3 border-t border-white/[0.04] ${sidebarCollapsed ? 'px-0 flex justify-center' : 'px-5'}`}
          >
            <div
              className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <div className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">
                  System Online
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-hidden relative z-0">
        <div className="h-full w-full p-6 page-enter" key={activeTab}>
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'configs' && <ConfigsView />}
            {activeTab === 'skills' && <SkillsView />}
            {activeTab === 'logs' && <LogsView />}
          </div>
        </div>
      </main>
    </div>
  );
}
