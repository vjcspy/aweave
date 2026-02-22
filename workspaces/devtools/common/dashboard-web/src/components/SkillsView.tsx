import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type SkillInfo = NonNullable<Awaited<ReturnType<typeof api.GET<'/skills'>>>['data']>['data'][0];

export function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    const res = await api.GET('/skills');
    if (res.data?.success) {
      setSkills(res.data.data);
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
      body: { active: !currentActive }
    });
    await loadSkills();
    setToggling(null);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-6">Agent Skills</h2>
      
      {loading && skills.length === 0 ? (
        <div className="text-zinc-500">Loading skills...</div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-1/2">Description</th>
                <th className="px-4 py-3 font-medium text-right">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {skills.map((skill) => (
                <tr key={skill.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-4 align-top">
                    <div className="font-medium text-zinc-200">{skill.name}</div>
                    <div className="text-xs text-zinc-500 mt-1 font-mono break-all">{skill.id}</div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 align-top">
                    {skill.description}
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <button
                      onClick={() => handleToggle(skill.id, skill.active)}
                      disabled={toggling === skill.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        skill.active ? 'bg-blue-600' : 'bg-zinc-700'
                      } ${toggling === skill.id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          skill.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              {skills.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    No skills found. Check your `agent/skills` or `~/.aweave/skills` directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
