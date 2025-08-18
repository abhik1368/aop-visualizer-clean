import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import NetworkGraph from './components/NetworkGraph';
import HypergraphNetworkGraph from './components/HypergraphNetworkGraph';

import SearchPanel from './components/SearchPanel';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import PerplexityAnalysisPanel from './components/PerplexityAnalysisPanel';
import TopStatusBar from './components/TopStatusBar';
import ResizablePanel from './components/ResizablePanel';
import './App.css';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('details');
  const [currentAOP, setCurrentAOP] = useState('');
  const [selectedNodeChain, setSelectedNodeChain] = useState([]);
  const searchPanelRef = useRef(null);

  // Incremental AOP selection and merged graph state
  const [selectedAopIds, setSelectedAopIds] = useState([]);
  // Use refs for large maps to avoid re-renders
  const mergedStoreRef = useRef({
    nodes: new Map(),      // id -> { ...node, sources: Set<string> }
    edges: new Map()       // key -> { source, target, relationship, ...edge, sources: Set<string> }
  });

  // Hypergraph state
  const [hypergraphEnabled, setHypergraphEnabled] = useState(false);
  const [maxNodesPerHypernode, setMaxNodesPerHypernode] = useState(4);
  const [layoutType, setLayoutType] = useState('euler');
  const [communityMethod, setCommunityMethod] = useState('louvain');
  // Removed nodeGroupingEnabled state as it's redundant with hypergraphEnabled
  const [communityData, setCommunityData] = useState(null);
  const [hypergraphData, setHypergraphData] = useState(null);
  const [networkProperties, setNetworkProperties] = useState(null);
  const [isHypergraphView, setIsHypergraphView] = useState(false);
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [visibleEdges, setVisibleEdges] = useState([]);
  const hypergraphRefreshRef = useRef(null);
  const [autoUpdateHypergraph] = useState(true); // allow toggling later if needed
  
  // AI Analysis state - persisted across tab switches
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // Theme management and initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    
    // Clear any cached AOP selections to ensure clean startup
    // Only clear if we don't have any current selections
    if (selectedAopIds.length === 0) {
      localStorage.removeItem('selectedAops');
      console.log('Initialized app with clean AOP state');
    }
  }, []);

  // AOP list is loaded inside AOPSelectionPanel

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // ---------- Incremental AOP selection + merged store ----------
  const fetchAopGraph = async (aopId) => {
    try {
      const url = `http://localhost:5001/aop_graph?aop=${encodeURIComponent(aopId)}`;
      console.log(`Fetching AOP graph for ID: "${aopId}" from URL: ${url}`);
      const r = await fetch(url);
      if (!r.ok) {
        console.error(`HTTP ${r.status} error fetching AOP ${aopId}`);
        throw new Error(`Failed to fetch ${aopId}: HTTP ${r.status}`);
      }
      const data = await r.json();
      console.log(`Successfully fetched AOP ${aopId} with ${data.nodes?.length || 0} nodes and ${data.edges?.length || 0} edges`);
      return data;
    } catch (e) {
      console.error('fetchAopGraph error for AOP:', aopId, e);
      return { nodes: [], edges: [] };
    }
  };

  const edgeKey = (e) => {
    const rel = e.relationship || e.type || '';
    return `${e.source}|${e.target}|${rel}`;
  };

  const materializeStore = () => {
    const nodes = [];
    const edges = [];
    mergedStoreRef.current.nodes.forEach((val) => {
      const sources = Array.from(val.sources || []);
      const { sources: _s, ...rest } = val;
      nodes.push({ ...rest, aop_sources: sources });
    });
    mergedStoreRef.current.edges.forEach((val) => {
      const sources = Array.from(val.sources || []);
      const { sources: _s, ...rest } = val;
      edges.push({ ...rest, aop_sources: sources });
    });
    return { nodes, edges };
  };

  const mergeGraph = (aopId, graph) => {
    const store = mergedStoreRef.current;
    // Nodes
    (graph.nodes || []).forEach((n) => {
      const id = n.id;
      if (!id) return;
      if (!store.nodes.has(id)) {
        store.nodes.set(id, { ...n, sources: new Set([aopId]) });
      } else {
        const existing = store.nodes.get(id);
        // Aggregate metadata conservatively (prefer existing, fill blanks)
        store.nodes.set(id, {
          ...existing,
          label: existing.label || n.label,
          type: existing.type || n.type,
          aop: existing.aop || n.aop,
          ontology: existing.ontology || n.ontology,
          ontology_term: existing.ontology_term || n.ontology_term,
          change: existing.change || n.change,
          sources: new Set([...(existing.sources || []), aopId])
        });
      }
    });
    // Edges
    (graph.edges || []).forEach((e) => {
      if (!e || !e.source || !e.target) return;
      const key = edgeKey(e);
      if (!store.edges.has(key)) {
        const rel = e.relationship || e.type || '';
        store.edges.set(key, {
          id: key,
          source: e.source,
          target: e.target,
          relationship: rel,
          confidence: e.confidence,
          adjacency: e.adjacency,
          type: e.type,
          sources: new Set([aopId])
        });
      } else {
        const existing = store.edges.get(key);
        store.edges.set(key, {
          ...existing,
          confidence: existing.confidence || e.confidence,
          adjacency: existing.adjacency || e.adjacency,
          type: existing.type || e.type,
          sources: new Set([...(existing.sources || []), aopId])
        });
      }
    });
  };

  const subtractGraph = (aopId) => {
    const store = mergedStoreRef.current;
    // Remove aopId from sources; drop items with no sources left
    store.nodes.forEach((val, id) => {
      if (val.sources && val.sources.has(aopId)) {
        val.sources.delete(aopId);
        if (val.sources.size === 0) {
          store.nodes.delete(id);
        }
      }
    });
    store.edges.forEach((val, key) => {
      if (val.sources && val.sources.has(aopId)) {
        val.sources.delete(aopId);
        if (val.sources.size === 0) {
          store.edges.delete(key);
        }
      }
    });
  };

  const debouncedSelectionTimer = useRef(null);
  const [isMerging, setIsMerging] = useState(false);
  const [autoFitOnUpdate, setAutoFitOnUpdate] = useState(true);
  const [compactness, setCompactness] = useState(60); // 0..100

  const toggleLeftPanel = () => {
    setSidebarOpen(prevState => !prevState);
  };

  // Simplified AOP selection handler with better state management
  const handleAOPSelect = async (payload, aopLabel) => {
    console.log('AOP Select called with:', payload, aopLabel);
    
    // Clear any existing selection states
    setSelectedNode(null);
    setSelectedEdge(null);
    
    // Handle direct graph data (legacy path from comprehensive search)
    if (payload && Array.isArray(payload.nodes)) {
      console.log('Direct graph data received:', payload.nodes.length, 'nodes');
      setIsMerging(true);
      
      // Add slight delay to show loading state
      setTimeout(() => {
        setGraphData({
          nodes: payload.nodes || [],
          edges: payload.edges || []
        });
        setCurrentAOP(aopLabel || '');
        setSelectedAopIds([]);
        setIsMerging(false);
      }, 100);
      return;
    }

    // Handle incremental selection change
    if (payload && payload.__selectionChange && Array.isArray(payload.aopIds)) {
      console.log('Incremental selection change:', payload.aopIds);
      const newIds = payload.aopIds;
      
      setIsMerging(true);
      
      // Store selection
      setSelectedAopIds(newIds);
      localStorage.setItem('selectedAops', JSON.stringify(newIds));

      // Clear current store
      mergedStoreRef.current = {
        nodes: new Map(),
        edges: new Map()
      };

      // Load all selected AOPs
      if (newIds.length > 0) {
        try {
          console.log('Loading AOPs in sequence:', newIds);
          for (const id of newIds) {
            console.log(`Processing AOP ID: "${id}"`);
            const graphData = await fetchAopGraph(id);
            if (graphData && (graphData.nodes || graphData.edges)) {
              console.log(`Merging graph data for AOP ${id}`);
              mergeGraph(id, graphData);
            } else {
              console.warn(`No valid graph data received for AOP ${id}`);
            }
          }
          
          // Update graph with merged data
          const mergedData = materializeStore();
          console.log(`Final merged data: ${mergedData.nodes?.length || 0} nodes, ${mergedData.edges?.length || 0} edges`);
          // Tag as multi-AOP so hypergraph can choose force layout
          setGraphData({
            nodes: mergedData.nodes || [],
            edges: mergedData.edges || [],
            metadata: { source: 'multi_aop', layout_hint: 'force' }
          });
          setCurrentAOP(newIds.join(', '));
        } catch (error) {
          console.error('Error loading AOPs:', error);
          // Don't leave user with loading state - show empty graph
          setGraphData({ nodes: [], edges: [] });
          setCurrentAOP('');
        }
      } else {
        // No AOPs selected, clear graph
        console.log('No AOPs selected, clearing graph');
        setGraphData({ nodes: [], edges: [] });
        setCurrentAOP('');
      }
      
      setIsMerging(false);
    }
  };
  // Advertise that we handle incremental selection protocol
  handleAOPSelect.__expectsIncremental = true;

  // AOP loading/selection handled by AOPSelectionPanel
  
  // Normalize inputs so downstream consumers never crash if a string id slips through
  const handleNodeSelect = (nodeOrId) => {
    let nodeObj = null;
    try {
      if (!nodeOrId) {
        nodeObj = null;
      } else if (typeof nodeOrId === 'string') {
        // Resolve to full node object from current graph
        const found = (graphData?.nodes || []).find(n => n.id === nodeOrId);
        nodeObj = found ? { ...found } : { id: nodeOrId, label: nodeOrId, type: 'Unknown' };
      } else if (typeof nodeOrId === 'object') {
        // Ensure minimal fields
        const id = nodeOrId.id || nodeOrId.data?.id;
        nodeObj = {
          id,
          label: nodeOrId.label || nodeOrId.data?.label || id,
          type: nodeOrId.type || nodeOrId.data?.type || 'Unknown',
          ...nodeOrId
        };
      }
    } catch (e) {
      console.warn('handleNodeSelect normalization failed:', e);
      nodeObj = null;
    }
  
    setSelectedNode(nodeObj);
    setSelectedEdge(null);
    if (nodeObj) {
      setActiveRightTab('details');
    }
  };
  
  const handleEdgeSelect = (edgeOrId) => {
    let edgeObj = null;
    try {
      if (!edgeOrId) {
        edgeObj = null;
      } else if (typeof edgeOrId === 'string') {
        const found = (graphData?.edges || []).find(e => e.id === edgeOrId);
        edgeObj = found ? { ...found } : { id: edgeOrId };
      } else if (typeof edgeOrId === 'object') {
        const id = edgeOrId.id || `${edgeOrId.source}-${edgeOrId.target}`;
        edgeObj = {
          id,
          source: edgeOrId.source,
          target: edgeOrId.target,
          relationship: edgeOrId.relationship || edgeOrId.type || '',
          ...edgeOrId
        };
      }
    } catch (e) {
      console.warn('handleEdgeSelect normalization failed:', e);
      edgeObj = null;
    }
  
    setSelectedEdge(edgeObj);
    setSelectedNode(null);
    if (edgeObj) {
      setActiveRightTab('details');
    }
  };

  const handleNodeChainUpdate = (nodeChain) => {
    setSelectedNodeChain(nodeChain);
  };

  // Hypergraph API functions
  const detectCommunities = async (method = communityMethod) => {
    try {
      // Handle multiple AOPs by sending null (will use all graph data)
      const aopParam = currentAOP && !currentAOP.includes(',') ? currentAOP : null;
      
      const response = await fetch('http://localhost:5001/community_detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: method,
          aop: aopParam,
          resolution: 1.0
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setCommunityData(result);
      console.log('Community detection result:', result);
      return result;
    } catch (error) {
      console.error('Community detection failed:', error);
      return null;
    }
  };

  const createHypergraph = async () => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      console.log('No graph data for hypergraph creation');
      return null;
    }

    console.log('Creating hypergraph with', graphData.nodes.length, 'nodes');
    
    try {
      const response = await fetch('http://localhost:5001/hypergraph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodes: graphData.nodes,
          edges: graphData.edges,
          community_method: communityMethod || 'louvain',
          use_communities: true,
          use_type_groups: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Hypergraph API error: ${response.status}`);
      }
      
      const result = await response.json();
      setHypergraphData(result);
      
      if (result.community_data) {
        setCommunityData(result.community_data);
      }
      if (result.network_properties) {
        setNetworkProperties(result.network_properties);
      }
      
      console.log('Hypergraph created successfully');
      return result;
    } catch (error) {
      console.error('Hypergraph creation failed:', error);
      // Don't set error states that could break UI - just log and continue
      return null;
    }
  };

  const analyzeNetwork = async () => {
    try {
      // Handle multiple AOPs by sending empty parameter (will use all graph data)
      const aopParam = currentAOP && !currentAOP.includes(',') ? currentAOP : '';
      const url = aopParam ? `http://localhost:5001/network_analysis?aop=${aopParam}` : 'http://localhost:5001/network_analysis';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setNetworkProperties(result);
      console.log('Network analysis result:', result);
      return result;
    } catch (error) {
      console.error('Network analysis failed:', error);
      return null;
    }
  };

  // Hypergraph toggle with immediate view switching and better UX
  const handleHypergraphToggle = (enabled) => {
    console.log('Toggling hypergraph view:', enabled);
    
    // Always immediately switch the view state for instant feedback
    setHypergraphEnabled(enabled);
    setIsHypergraphView(enabled);
    
    if (enabled) {
      // Enabling hypergraph mode
      console.log('Enabling hypergraph mode');
      
      // If we have data, create enhanced hypergraph data in background
      if (graphData?.nodes?.length > 0) {
        // The HypergraphNetworkGraph component can work with regular data initially
        // and will be enhanced once the backend processing completes
        createHypergraph().catch(error => {
          console.warn('Hypergraph enhancement failed, using basic grouping:', error);
          // Component will fall back to client-side grouping
        });
      }
    } else {
      // Disabling hypergraph mode - return to regular network view
      console.log('Disabling hypergraph mode - returning to regular view');
      setHypergraphData(null);
      setCommunityData(null);
      setNetworkProperties(null);
    }
  };

  // Auto-refresh hypergraph when underlying graph changes while hypergraph mode is on
  useEffect(() => {
    if (!hypergraphEnabled || !autoUpdateHypergraph) return;
    if (!graphData || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0) return;
    // Debounce rapid updates while merging AOPs
    if (hypergraphRefreshRef.current) {
      clearTimeout(hypergraphRefreshRef.current);
    }
    hypergraphRefreshRef.current = setTimeout(() => {
      createHypergraph();
    }, 250);
    return () => {
      if (hypergraphRefreshRef.current) clearTimeout(hypergraphRefreshRef.current);
    };
  }, [graphData, hypergraphEnabled, communityMethod]);

  const handleMaxNodesPerHypernodeChange = (newMaxNodes) => {
    console.log('Max nodes per hypernode changed to:', newMaxNodes);
    setMaxNodesPerHypernode(newMaxNodes);
    // No need to re-detect communities, just re-render with new splitting
  };

  const handleLayoutChange = (newLayout) => {
    setLayoutType(newLayout);
  };

  const handleCommunityDetection = async (method) => {
    setCommunityMethod(method);
    const result = await detectCommunities(method);
    
    if (hypergraphEnabled && result) {
      await createHypergraph();
    }
    
    return result;
  };

  // Removed handleNodeGrouping function as it's redundant with hypergraph toggle

  const rightPanelTabs = [
    { id: 'details', label: 'Details', icon: '📋' },
    { id: 'analysis', label: 'AI Analysis', icon: '🧠' }
  ];

  return (
    <div className={`h-screen bg-background text-foreground ${theme} overflow-hidden flex flex-col`}>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm z-50 flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLeftPanel}
              title="Toggle left panel"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <h1 className="text-xl font-bold">AOP Network Visualizer</h1>
            {currentAOP && (
              <div className="hidden md:block text-sm text-muted-foreground">
                Current AOP: {currentAOP}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Right panel stays permanently open */}
          </div>
        </div>
      </header>

      {/* Top Status Bar */}
      <div className="flex-shrink-0">
        <TopStatusBar 
          graphData={graphData} 
          currentAOP={currentAOP}
          visibleNodes={visibleNodes}
          visibleEdges={visibleEdges}
        />
      </div>

      <div className="flex flex-1 bg-background w-full overflow-hidden min-h-0">{/* Left Resizable Sidebar */}
        {sidebarOpen && (
          <ResizablePanel 
            side="left" 
            initialWidth={320}
            minWidth={250}
            maxWidth={500}
            className="border-r bg-card flex-shrink-0"
          >
            <div className="h-full overflow-y-auto">
              <div className="p-4">
                <SearchPanel
                  ref={searchPanelRef}
                  onAOPSelect={handleAOPSelect}
                  onNodeSelect={handleNodeSelect}
                  onSearchResults={setSearchResults}
                  graphData={isHypergraphView ? hypergraphData : graphData}
                  onNodeChainUpdate={handleNodeChainUpdate}
                  hypergraphEnabled={hypergraphEnabled}
                  onHypergraphToggle={handleHypergraphToggle}
                  maxNodesPerHypernode={maxNodesPerHypernode}
                  onMaxNodesPerHypernodeChange={handleMaxNodesPerHypernodeChange}
                  communityMethod={communityMethod}
                  onCommunityDetection={handleCommunityDetection}
                />
              </div>
            </div>
          </ResizablePanel>
        )}

        {/* Main Content */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {/* Graph Area */}
          <div className="flex-1 p-4 min-w-0 overflow-hidden">
            <Card className="h-full flex flex-col overflow-hidden">
              {/* Loading state */}
              {isMerging ? (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div className="text-lg font-semibold text-gray-700">Loading AOP Network...</div>
                    <div className="text-sm text-gray-500 mt-2">
                      {selectedAopIds.length > 0 ? `Processing ${selectedAopIds.length} AOP(s)` : 'Preparing visualization'}
                    </div>
                  </div>
                </div>
              ) : !graphData || !graphData.nodes || graphData.nodes.length === 0 ? (
                /* Empty state */
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <div className="text-center">
                    <div className="text-gray-500 text-6xl mb-4">📊</div>
                    <div className="text-lg font-semibold text-gray-700 mb-2">No Network Data</div>
                    <div className="text-sm text-gray-500 mb-4">
                      Select one or more AOPs from the search panel to visualize the network
                    </div>
                    <div className="text-xs text-gray-400">
                      Use the search panel on the left to get started
                    </div>
                  </div>
                </div>
              ) : hypergraphEnabled ? (
                /* Hypergraph view */
                <div className="h-full overflow-hidden">
                  <HypergraphNetworkGraph
                    data={graphData}
                    hypergraphData={hypergraphData}
                    onNodeSelect={handleNodeSelect}
                    onEdgeSelect={handleEdgeSelect}
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    theme={theme}
                    hypergraphEnabled={hypergraphEnabled}
                    maxNodesPerHypernode={maxNodesPerHypernode}
                    layoutType={layoutType}
                    communityData={communityData}
                  />
                </div>
              ) : (
                /* Regular network view */
                <div className="h-full overflow-hidden">
                  <NetworkGraph
                    data={graphData}
                    onNodeSelect={handleNodeSelect}
                    onEdgeSelect={handleEdgeSelect}
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    theme={theme}
                    onVisibleNodesChange={(nodes, edges) => {
                      setVisibleNodes(nodes);
                      setVisibleEdges(edges);
                    }}
                    compactness={compactness}
                    onCompactnessChange={(val) => setCompactness(val)}
                    autoFitOnUpdate={autoFitOnUpdate}
                    onAutoFitToggle={(checked) => setAutoFitOnUpdate(checked)}
                    selectedAopCount={selectedAopIds.length}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Right Resizable Panel - Always visible */}
          <ResizablePanel 
            side="right" 
            initialWidth={350}
            minWidth={250}
            maxWidth={400}
            className="border-l bg-card flex-shrink-0"
          >
            <div className="h-full overflow-hidden flex flex-col">
              {/* Tab Navigation */}
              <div className="flex border-b bg-muted/50 flex-shrink-0">
                <button
                  onClick={() => setActiveRightTab('details')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeRightTab === 'details'
                      ? 'bg-background text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveRightTab('analysis')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeRightTab === 'analysis'
                      ? 'bg-background text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    AI Analysis
                  </div>
                </button>
              </div>

              {/* Tab Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  {activeRightTab === 'details' && (
                    <NodeDetailsPanel 
                      selectedNode={selectedNode} 
                      selectedEdge={selectedEdge}
                      graphData={isHypergraphView ? hypergraphData : graphData}
                    />
                  )}
                  {activeRightTab === 'analysis' && (
                    <PerplexityAnalysisPanel 
                      graphData={isHypergraphView ? hypergraphData : graphData}
                      selectedNode={selectedNode}
                      analysisResult={analysisResult}
                      setAnalysisResult={setAnalysisResult}
                      analysisLoading={analysisLoading}
                      setAnalysisLoading={setAnalysisLoading}
                      analysisError={analysisError}
                      setAnalysisError={setAnalysisError}
                    />
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
