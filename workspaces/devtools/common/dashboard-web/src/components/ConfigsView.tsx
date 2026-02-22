import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Save, Folder, FileJson, ChevronRight, Settings2, Box, RefreshCcw } from 'lucide-react';

type ConfigDomain = NonNullable<Awaited<ReturnType<typeof api.GET<'/configs'>>>['data']>['data'][0];

export function ConfigsView() {
  const [domains, setDomains] = useState<ConfigDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  const [rawText, setRawText] = useState('');
  const [effectiveJson, setEffectiveJson] = useState('');
  const [loading, setLoading] = useState(false);

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
      api.GET('/configs/{domain}/{name}', {
        params: { path: { domain: selectedDomain, name: selectedConfig } }
      }).then((res) => {
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
      body: { rawContent: rawText }
    });
    // reload to see effective changes
    const res = await api.GET('/configs/{domain}/{name}', {
      params: { path: { domain: selectedDomain, name: selectedConfig } }
    });
    if (res.data?.success) {
      setEffectiveJson(JSON.stringify(res.data.effectiveConfig, null, 2));
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full gap-6 text-zinc-300">
      {/* Sidebar List */}
      <div className="w-72 flex flex-col gap-4">
        <div className="glass-panel p-4 rounded-xl flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <Box className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Config Domains</h2>
          </div>
          
          {domains.map((dom) => (
            <div key={dom.domain} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3 text-zinc-400">
                <Folder className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">{dom.domain}</h3>
              </div>
              <ul className="space-y-1 ml-2 border-l border-zinc-800/50 pl-2">
                {dom.files.map((file) => {
                  const isActive = selectedDomain === dom.domain && selectedConfig === file.name;
                  return (
                    <li key={file.name}>
                      <button
                        onClick={() => {
                          setSelectedDomain(dom.domain);
                          setSelectedConfig(file.name);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-300 group ${
                          isActive 
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileJson className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
                          {file.name}
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 animate-in slide-in-from-left-2 opacity-70" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConfig ? (
          <div className="glass-panel rounded-xl flex flex-col items-center justify-center h-full text-zinc-500 gap-4 animate-in fade-in zoom-in-95 duration-500">
            <Settings2 className="w-16 h-16 text-zinc-700" strokeWidth={1} />
            <p className="text-lg">Select a configuration file from the sidebar to edit it.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <FileJson className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-mono text-zinc-100">{selectedConfig}.yaml</h2>
                  <p className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                    <Folder className="w-3 h-3" /> {selectedDomain}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5"
              >
                {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? 'Saving...' : 'Save Override'}
              </button>
            </div>
            
            {/* Split Editors */}
            <div className="grid grid-cols-2 gap-px bg-white/5 h-full min-h-[500px] overflow-hidden">
              <div className="flex flex-col h-full bg-zinc-950/80">
                <div className="px-4 py-2 border-b border-white/5 bg-black/40 text-xs font-semibold text-zinc-400 tracking-wider flex items-center justify-between">
                  <span>User Override YAML</span>
                  <span className="text-zinc-600">~/.aweave/config/{selectedDomain}/...</span>
                </div>
                <div className="flex-1 relative p-4 group">
                  <textarea
                    className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] bg-transparent font-mono text-sm text-blue-100 placeholder-zinc-700 focus:outline-none resize-none z-10 custom-scrollbar"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    spellCheck={false}
                    placeholder="# Add YAML overrides here.&#10;# E.g.&#10;# port: 8080&#10;# features:&#10;#   enabled: true"
                  />
                  {/* Subtle glowing border on focus within the textarea area */}
                  <div className="absolute inset-0 border border-transparent group-focus-within:border-blue-500/30 group-focus-within:bg-blue-500/5 pointer-events-none transition-all duration-500" />
                </div>
              </div>
              
              <div className="flex flex-col h-full bg-zinc-950/80">
                <div className="px-4 py-2 border-b border-white/5 bg-black/40 text-xs font-semibold text-zinc-400 tracking-wider flex items-center justify-between">
                  <span>Effective Config JSON</span>
                  <span className="text-zinc-600">Read-only (Merged)</span>
                </div>
                <div className="flex-1 relative p-4">
                  <pre className="absolute inset-4 overflow-auto font-mono text-sm text-zinc-400 custom-scrollbar">
                    {effectiveJson ? (
                      <code dangerouslySetInnerHTML={{ 
                        // Super basic syntax highlighting for JSON visualization
                        __html: effectiveJson
                          .replace(/"(.*?)":/g, '<span class="text-blue-300">"$1"</span>:')
                          .replace(/: "(.*?)"/g, ': <span class="text-green-300">"$1"</span>')
                          .replace(/: (true|false)/g, ': <span class="text-purple-400">$1</span>')
                          .replace(/: (\d+)/g, ': <span class="text-orange-300">$1</span>')
                      }} />
                    ) : (
                      <span className="text-zinc-600 italic">No effective config generated...</span>
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
