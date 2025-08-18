import React, { useEffect, useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getApiUrl } from '../config';

// Utility to combine multiple AOP graphs into a single graph
const combineGraphs = (graphs, aopIds) => {
  const nodeMap = new Map();
  const edges = [];

  graphs.forEach((g, idx) => {
    const aop = aopIds[idx];
    (g.nodes || []).forEach((n) => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, { ...n, aop_source: new Set([aop]) });
      } else {
        // track sources across AOPs
        nodeMap.get(n.id).aop_source.add(aop);
      }
    });
    (g.edges || []).forEach((e) => {
      edges.push({ ...e, aop_source: aop });
    });
  });

  // convert aop_source sets to arrays for serialization
  const nodes = Array.from(nodeMap.values()).map((n) => ({
    ...n,
    aop_source: Array.from(n.aop_source || []),
  }));

  return { nodes, edges };
};

export default function AOPSelectionPanel({
  onAOPSelect,
  hypergraphEnabled,
  onHypergraphToggle,
  maxNodesPerHypernode,
  onMaxNodesPerHypernodeChange,
  layoutType,
  onLayoutChange,
}) {
  const [aops, setAops] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]); // array of ids
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Try detailed first
        let list = [];
        try {
          const r = await fetch(getApiUrl('/aops_detailed'));
          if (r.ok) {
            const d = await r.json();
            list = (d || []).map((x) => ({ id: x.id ?? x, title: x.title ?? `AOP ${x.id ?? x}` }));
          }
        } catch {}
        if (!list.length) {
          const r2 = await fetch(getApiUrl('/aops'));
          const d2 = await r2.json();
          list = (d2 || []).map((x) => ({ id: x, title: `AOP ${x}` }));
        }
        setAops(list);
        setFiltered(list);
      } catch (e) {
        console.error('Failed to load AOPs', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!query.trim()) return setFiltered(aops);
    const q = query.toLowerCase();
    setFiltered(
      aops.filter((x) => `${x.id}`.toLowerCase().includes(q) || (x.title || '').toLowerCase().includes(q)).slice(0, 25)
    );
  }, [query, aops]);

  const addAop = (id) => {
    if (!id) return;
    if (selected.includes(id)) return;
    setSelected((s) => [...s, id]);
  };

  const removeAop = (id) => setSelected((s) => s.filter((x) => x !== id));

  const clearAll = () => setSelected([]);

  const loadSelected = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const graphs = await Promise.all(
        selected.map(async (aop) => {
          const r = await fetch(getApiUrl('/aop_graph', { aop }));
          return r.ok ? await r.json() : { nodes: [], edges: [] };
        })
      );
      const combined = combineGraphs(graphs, selected);
      onAOPSelect && onAOPSelect(combined, selected.join(', '));
    } catch (e) {
      console.error('Failed to load AOP graphs', e);
      onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Analysis Mode</label>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <input type="radio" checked readOnly className="mt-1" />
            <div>
              <div className="text-sm font-medium">AOP Selection - Browse complete AOP networks</div>
              <div className="text-xs text-muted-foreground">Pick one or more AOPs; the combined network will render.</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Search & Select AOPs</label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search AOPs (e.g., '431', 'liver')"
          className="mb-2"
        />
        <select
          value=""
          onChange={(e) => addAop(e.target.value)}
          className="w-full p-2 border rounded-md bg-background"
        >
          <option value="">Select an AOP…</option>
          {filtered.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>

        {!!selected.length && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-muted-foreground">Selected AOPs ({selected.length}):</div>
            <div className="flex flex-wrap gap-2">
              {selected.map((id) => (
                <Badge key={id} variant="secondary" className="flex items-center gap-2">
                  {id}
                  <button aria-label="Remove" onClick={() => removeAop(id)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={loadSelected} disabled={loading}>
                {loading ? 'Loading…' : 'Load Selected AOPs'}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t">
        <h4 className="text-md font-semibold mb-2">Hypergraph Analysis</h4>
        <div className="flex items-center gap-2 mb-2">
          <input
            id="hypergraph-toggle"
            type="checkbox"
            checked={hypergraphEnabled}
            onChange={(e) => onHypergraphToggle && onHypergraphToggle(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="hypergraph-toggle" className="text-sm">Enable hypergraph view</label>
        </div>

        {!hypergraphEnabled && (
          <div className="text-xs text-muted-foreground mb-2">
            Tip: Hypergraph will use the nodes currently visible in the network panel.
          </div>
        )}

        {hypergraphEnabled && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Max nodes per hypernode</label>
              <input
                type="range"
                min={2}
                max={12}
                value={maxNodesPerHypernode}
                onChange={(e) => onMaxNodesPerHypernodeChange && onMaxNodesPerHypernodeChange(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">{maxNodesPerHypernode} nodes</div>
            </div>

            <div>
              <label className="text-sm font-medium">Layout</label>
              <select
                value={layoutType}
                onChange={(e) => onLayoutChange && onLayoutChange(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="fcose">Force-directed (fCoSE)</option>
                <option value="grid">Grid</option>
                <option value="cose">CoSE</option>
                <option value="circle">Circle</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
