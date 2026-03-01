import {
  Box,
  ChevronRight,
  FileCode2,
  Folder,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { api } from '../lib/api';

type ConfigDomain = NonNullable<
  Awaited<ReturnType<typeof api.GET<'/configs'>>>['data']
>['data'][0];

export function ConfigsView() {
  const [domains, setDomains] = useState<ConfigDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  const [rawText, setRawText] = useState('');
  const [effectiveJson, setEffectiveJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.GET('/configs').then((res) => {
      if (res.data?.success) {
        setDomains(res.data.data);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedDomain && selectedConfig) {
      setLoading(true);
      api
        .GET('/configs/{domain}/{name}', {
          params: { path: { domain: selectedDomain, name: selectedConfig } },
        })
        .then((res) => {
          if (res.data?.success) {
            setRawText(res.data.rawUserConfig || '');
            setEffectiveJson(JSON.stringify(res.data.effectiveConfig, null, 2));
          }
          setLoading(false);
        });
    }
  }, [selectedDomain, selectedConfig]);

  const handleSave = async () => {
    if (!selectedDomain || !selectedConfig) return;
    setLoading(true);
    await api.PUT('/configs/{domain}/{name}', {
      params: { path: { domain: selectedDomain, name: selectedConfig } },
      body: { rawContent: rawText },
    });
    const res = await api.GET('/configs/{domain}/{name}', {
      params: { path: { domain: selectedDomain, name: selectedConfig } },
    });
    if (res.data?.success) {
      setEffectiveJson(JSON.stringify(res.data.effectiveConfig, null, 2));
    }
    setLoading(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex h-full gap-5 text-zinc-300">
      {/* ── Sidebar ── */}
      <div className="w-64 flex flex-col gap-4 shrink-0">
        <div className="glass-panel p-5 rounded-2xl flex-1 overflow-y-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center border border-blue-500/20">
              <Box className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Config Domains
            </h2>
          </div>

          {domains.map((dom) => (
            <div key={dom.domain} className="mb-5 last:mb-0">
              <div className="flex items-center gap-2 mb-2.5 text-zinc-500">
                <Folder className="w-3.5 h-3.5" />
                <h3 className="text-[11px] font-semibold uppercase tracking-widest">
                  {dom.domain}
                </h3>
              </div>
              <ul className="space-y-0.5 ml-1 border-l border-zinc-800/40 pl-2">
                {dom.files.map((file) => {
                  const isActive =
                    selectedDomain === dom.domain &&
                    selectedConfig === file.name;
                  return (
                    <li key={file.name}>
                      <button
                        onClick={() => {
                          setSelectedDomain(dom.domain);
                          setSelectedConfig(file.name);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group ${
                          isActive
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/15 glow-blue'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode2
                            className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}
                          />
                          <span>{file.name}</span>
                        </div>
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Editor Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConfig ? (
          <div className="glass-panel rounded-2xl flex flex-col items-center justify-center h-full text-zinc-600 gap-5">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800/30 flex items-center justify-center border border-zinc-700/20">
              <Settings2
                className="w-10 h-10 text-zinc-700"
                strokeWidth={1.2}
              />
            </div>
            <div className="text-center">
              <p className="text-base text-zinc-400 font-medium">
                Select a config file
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                Choose from the sidebar to view and edit
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center border border-blue-500/20">
                  <FileCode2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold font-mono text-zinc-100 tracking-tight">
                    {selectedConfig}.yaml
                  </h2>
                  <p className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                    <Folder className="w-3 h-3" /> {selectedDomain}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={loading}
                className="btn-gradient flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {loading
                  ? 'Saving...'
                  : saveSuccess
                    ? 'Saved!'
                    : 'Save Override'}
              </button>
            </div>

            {/* Split Editors */}
            <div className="grid grid-cols-2 gap-px bg-white/[0.03] h-full min-h-[500px] overflow-hidden">
              {/* YAML Editor */}
              <div className="flex flex-col h-full bg-[#08080c]/80">
                <div className="px-4 py-2.5 border-b border-white/[0.04] bg-black/30 text-[11px] font-semibold text-zinc-500 tracking-wider flex items-center justify-between uppercase">
                  <span>User Override YAML</span>
                  <span className="text-zinc-700 normal-case font-mono text-[10px]">
                    ~/.aweave/config/{selectedDomain}/...
                  </span>
                </div>
                <div className="flex-1 relative p-4 group">
                  <textarea
                    className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] bg-transparent font-mono text-[13px] leading-relaxed text-blue-100/90 placeholder-zinc-700 focus:outline-none resize-none z-10"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    spellCheck={false}
                    placeholder={`# Add YAML overrides here.\n# E.g.\n# port: 8080\n# features:\n#   enabled: true`}
                  />
                  {/* Focus glow */}
                  <div className="absolute inset-0 rounded-lg border border-transparent group-focus-within:border-blue-500/20 group-focus-within:bg-blue-500/[0.02] pointer-events-none transition-all duration-500" />
                </div>
              </div>

              {/* JSON Preview */}
              <div className="flex flex-col h-full bg-[#08080c]/80">
                <div className="px-4 py-2.5 border-b border-white/[0.04] bg-black/30 text-[11px] font-semibold text-zinc-500 tracking-wider flex items-center justify-between uppercase">
                  <span>Effective Config JSON</span>
                  <span className="text-zinc-700 normal-case text-[10px]">
                    Read-only (Merged)
                  </span>
                </div>
                <div className="flex-1 relative p-4">
                  <pre className="absolute inset-4 overflow-auto font-mono text-[13px] leading-relaxed text-zinc-400">
                    {effectiveJson ? (
                      <code
                        dangerouslySetInnerHTML={{
                          __html: effectiveJson
                            .replace(
                              /"(.*?)":/g,
                              '<span class="text-blue-300/80">"$1"</span>:',
                            )
                            .replace(
                              /: "(.*?)"/g,
                              ': <span class="text-emerald-300/80">"$1"</span>',
                            )
                            .replace(
                              /: (true|false)/g,
                              ': <span class="text-purple-400">$1</span>',
                            )
                            .replace(
                              /: (\d+)/g,
                              ': <span class="text-amber-300/80">$1</span>',
                            ),
                        }}
                      />
                    ) : (
                      <span className="text-zinc-700 italic">
                        No effective config generated...
                      </span>
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
