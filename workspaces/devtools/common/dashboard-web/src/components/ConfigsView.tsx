import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

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
    <div className="flex h-full gap-4">
      {/* Sidebar List */}
      <div className="w-64 border-r border-zinc-800 pr-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Domains</h2>
        {domains.map((dom) => (
          <div key={dom.domain} className="mb-4">
            <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">{dom.domain}</h3>
            <ul className="space-y-1">
              {dom.files.map((file) => {
                const isActive = selectedDomain === dom.domain && selectedConfig === file.name;
                return (
                  <li key={file.name}>
                    <button
                      onClick={() => {
                        setSelectedDomain(dom.domain);
                        setSelectedConfig(file.name);
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                        isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      {file.name}.yaml
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Editor Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConfig ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            Select a config file to view and edit.
          </div>
        ) : (
          <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-mono text-zinc-200">{selectedDomain} / {selectedConfig}.yaml</h2>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save User Override'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 h-full min-h-[500px]">
              <div className="flex flex-col h-full">
                <label className="text-sm text-zinc-400 mb-2">User Override (~/.aweave/config/{selectedDomain}/{selectedConfig}.yaml)</label>
                <textarea
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="# Add YAML overrides here"
                />
              </div>
              <div className="flex flex-col h-full">
                <label className="text-sm text-zinc-400 mb-2">Effective Config (Read-only JSON)</label>
                <pre className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-4 font-mono text-sm text-zinc-400 overflow-auto">
                  {effectiveJson}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
