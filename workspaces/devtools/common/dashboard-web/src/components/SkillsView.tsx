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
      // Sort so active skills are at the top, then alphabetically
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
    const safeId = encodeURIComponent(id); // Ensure id paths are safe if they contain slashes
    await api.POST('/skills/{skillId}/toggle', {
      params: { path: { skillId: safeId } },
      body: { active: !currentActive },
    });
    await loadSkills();
    setToggling(null);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Cpu className="text-purple-400 w-7 h-7" />
            Agent Skills
          </h2>
          <p className="text-zinc-400 mt-1">
            Enable or disable specialized AI sub-agents to enhance your
            workspace contextual understanding.
          </p>
        </div>

        {loading && skills.length > 0 && (
          <div className="flex items-center gap-2 text-zinc-400 bg-white/5 px-3 py-1.5 rounded-full text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Updating...
          </div>
        )}
      </div>

      {loading && skills.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p>Discovering capabilities...</p>
        </div>
      ) : skills.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">
            No Skills Found
          </h3>
          <p className="text-zinc-500 max-w-md">
            The workspace didn't return any skills. Make sure you have valid
            `SKILL.md` files in `agent/skills/` or `~/.aweave/skills/`.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-12 custom-scrollbar pr-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`relative glass-panel rounded-2xl p-6 flex flex-col transition-all duration-300 overflow-hidden group hover:-translate-y-1 ${
                skill.active
                  ? 'border-purple-500/30 shadow-[0_8px_30px_rgba(168,85,247,0.15)] bg-gradient-to-b from-purple-500/5 to-transparent'
                  : 'hover:border-white/10'
              }`}
            >
              {/* Background Glow Effect for Active Card */}
              {skill.active && (
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
              )}

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div
                  className={`p-3 rounded-xl inline-flex ${skill.active ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-zinc-400'}`}
                >
                  {skill.active ? (
                    <Sparkles className="w-6 h-6" />
                  ) : (
                    <Waypoints className="w-6 h-6" />
                  )}
                </div>

                {/* Advanced Premium Toggle */}
                <button
                  onClick={() => handleToggle(skill.id, skill.active)}
                  disabled={toggling === skill.id}
                  className={`relative flex items-center h-7 w-14 rounded-full transition-all duration-300 focus:outline-none overflow-hidden ${
                    skill.active
                      ? 'bg-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.6)]'
                      : 'bg-zinc-700/80 border border-white/5 hover:bg-zinc-600'
                  } ${toggling === skill.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <span
                    className={`absolute flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                      skill.active ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  >
                    {toggling === skill.id ? (
                      <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                    ) : skill.active ? (
                      <Power
                        className="w-3 h-3 text-purple-600"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                </button>
              </div>

              <div className="relative z-10 flex-1">
                <h3
                  className={`text-lg font-bold tracking-tight mb-2 ${skill.active ? 'text-white' : 'text-zinc-200'}`}
                >
                  {skill.name}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 mb-4">
                  {skill.description}
                </p>
              </div>

              <div className="relative z-10 pt-4 mt-auto border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 truncate max-w-[80%] bg-black/30 px-2 py-1 rounded">
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{skill.id}</span>
                </div>
                {skill.active && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
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
