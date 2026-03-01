import {
  Code2,
  Cpu,
  Loader2,
  Power,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { api } from '../lib/api';

type SkillInfo = NonNullable<
  Awaited<ReturnType<typeof api.GET<'/skills'>>>['data']
>['data'][0];

export function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    const res = await api.GET('/skills');
    if (res.data?.success) {
      const sorted = res.data.data.sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return a.name.localeCompare(b.name);
      });
      setSkills(sorted);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleToggle = async (id: string, currentActive: boolean) => {
    setToggling(id);
    const safeId = encodeURIComponent(id);
    await api.POST('/skills/{skillId}/toggle', {
      params: { path: { skillId: safeId } },
      body: { active: !currentActive },
    });
    await loadSkills();
    setToggling(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center border border-purple-500/20">
              <Cpu className="text-purple-400 w-5 h-5" />
            </div>
            Agent Skills
          </h2>
          <p className="text-zinc-500 mt-2 text-sm leading-relaxed max-w-lg">
            Enable or disable specialized AI sub-agents to enhance your
            workspace contextual understanding.
          </p>
        </div>

        {loading && skills.length > 0 && (
          <div className="flex items-center gap-2 text-zinc-400 glass-button px-4 py-2 rounded-full text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
          </div>
        )}
      </div>

      {/* Content */}
      {loading && skills.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            <div className="absolute inset-0 rounded-full blur-xl bg-purple-500/20" />
          </div>
          <p className="text-sm">Discovering capabilities...</p>
        </div>
      ) : skills.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-zinc-800/30 flex items-center justify-center border border-zinc-700/20 mb-6">
            <ShieldAlert
              className="w-10 h-10 text-zinc-700"
              strokeWidth={1.2}
            />
          </div>
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">
            No Skills Found
          </h3>
          <p className="text-zinc-500 max-w-md text-sm leading-relaxed">
            The workspace didn't return any skills. Make sure you have valid
            <code className="text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded mx-1 text-xs">
              SKILL.md
            </code>
            files.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pb-12 pr-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`relative glass-card rounded-2xl p-6 flex flex-col overflow-hidden group ${
                skill.active ? 'animated-border' : ''
              }`}
            >
              {/* Background Glow for Active */}
              {skill.active && (
                <>
                  <div className="absolute -top-16 -right-16 w-32 h-32 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                </>
              )}

              {/* Top Row: Icon + Toggle */}
              <div className="flex justify-between items-start mb-5 relative z-10">
                <div
                  className={`p-3 rounded-xl inline-flex ${
                    skill.active
                      ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10 text-purple-300 border border-purple-500/20'
                      : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06]'
                  }`}
                >
                  {skill.active ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <Waypoints className="w-5 h-5" />
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(skill.id, skill.active)}
                  disabled={toggling === skill.id}
                  className={`toggle-switch ${skill.active ? 'on' : 'off'} ${toggling === skill.id ? 'opacity-40 cursor-wait' : ''}`}
                >
                  <span className="toggle-thumb flex items-center justify-center">
                    {toggling === skill.id ? (
                      <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                    ) : skill.active ? (
                      <Power
                        className="w-2.5 h-2.5 text-purple-600"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                </button>
              </div>

              {/* Content */}
              <div className="relative z-10 flex-1">
                <h3
                  className={`text-[15px] font-bold tracking-tight mb-2 ${skill.active ? 'text-white' : 'text-zinc-300'}`}
                >
                  {skill.name}
                </h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-3 mb-4">
                  {skill.description}
                </p>
              </div>

              {/* Footer */}
              <div className="relative z-10 pt-4 mt-auto border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 truncate max-w-[75%] bg-black/20 px-2 py-1 rounded-md">
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{skill.id}</span>
                </div>
                {skill.active && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400/60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
