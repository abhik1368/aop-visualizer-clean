import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import NetworkGraph from './components/NetworkGraph';
import HypergraphNetworkGraph from './components/HypergraphNetworkGraph';

import SearchPanel from './components/SearchPanel';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import ChatPanel from './components/ChatPanel';
import PerplexityAnalysisPanel from './components/PerplexityAnalysisPanel';
import TopStatusBar from './components/TopStatusBar';
import ResizablePanel from './components/ResizablePanel';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('details');
  const [rightPanelTab, setRightPanelTab] = useState('details'); // 'details', 'chat'
  const [currentAOP, setCurrentAOP] = useState('');
  const [selectedNodeChain, setSelectedNodeChain] = useState([]);
  
  // Hypergraph state
  const [hypergraphEnabled, setHypergraphEnabled] = useState(false);
  const [maxNodesPerHypernode, setMaxNodesPerHypernode] = useState(4);
  const [layoutType, setLayoutType] = useState('fcose');
  const [communityMethod, setCommunityMethod] = useState('louvain');
  // Removed nodeGroupingEnabled state as it's redundant with hypergraphEnabled
  const [communityData, setCommunityData] = useState(null);
  const [hypergraphData, setHypergraphData] = useState(null);
  const [networkProperties, setNetworkProperties] = useState(null);
  const [isHypergraphView, setIsHypergraphView] = useState(false);
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [visibleEdges, setVisibleEdges] = useState([]);
  
  const searchPanelRef = useRef(null);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const toggleLeftPanel = () => {
    setSidebarOpen(prevState => !prevState);
  };

  const toggleRightPanel = () => {
    setRightPanelOpen(!rightPanelOpen);
  };

  const handleAOPSelect = (data, aopName) => {
    console.log('App handleAOPSelect called with:', { data, aopName });
    console.log('Data structure:', { nodes: data?.nodes?.length, edges: data?.edges?.length });
    setGraphData(data);
    setCurrentAOP(aopName);
    setSelectedNode(null);
    setSelectedEdge(null);
    console.log('Graph data updated in App state');
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (node) {
      setRightPanelTab('details');
    }
  };

  const handleEdgeSelect = (edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    if (edge) {
      setRightPanelTab('chat');
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
    try {
      console.log('DEBUG: graphData nodes length:', graphData?.nodes?.length || 0);
      console.log('DEBUG: visibleNodes length:', visibleNodes?.length || 0);
      
      // Determine what data to use for hypergraph creation
      let dataToProcess;
      
      if (graphData?.nodes?.length > 0) {
        // Use all graphData if we have it, or visible nodes if they're available and reasonable
        const nodesToUse = (visibleNodes.length > 0 && visibleNodes.length <= graphData.nodes.length) 
          ? visibleNodes 
          : graphData.nodes;
        
        console.log('Using nodes for hypergraph:', nodesToUse.length, 'nodes');
        const nodeIds = new Set(nodesToUse.map(n => n.id));
        const edgesToUse = graphData.edges.filter(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
        
        dataToProcess = {
          nodes: nodesToUse,
          edges: edgesToUse
        };
      } else {
        console.error('No graph data available for hypergraph');
        return null;
      }
      
      console.log('Using nodes for hypergraph:', dataToProcess.nodes.length, 'nodes,', dataToProcess.edges.length, 'edges');
      
      console.log('Creating hypergraph with:', {
        nodes: dataToProcess.nodes.length,
        edges: dataToProcess.edges.length,
        visibleNodes: visibleNodes.length
      });
      
      console.log('Sending hypergraph request with data:', dataToProcess);
      
      const response = await fetch('http://localhost:5001/hypergraph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodes: dataToProcess.nodes,
          edges: dataToProcess.edges,
          community_method: communityMethod,
          use_communities: true,
          use_type_groups: hypergraphEnabled // Use hypergraph setting instead of separate toggle
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setHypergraphData(result);
      setCommunityData(result.community_data);
      setNetworkProperties(result.network_properties);
      console.log('Hypergraph creation result:', result);
      return result;
    } catch (error) {
      console.error('Hypergraph creation failed:', error);
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

  // Hypergraph event handlers
  const handleHypergraphToggle = async (enabled) => {
    console.log('Toggling hypergraph view:', enabled);
    
    if (enabled) {
      // Switch to hypergraph view
      try {
        const result = await createHypergraph();
        if (result) {
          setHypergraphEnabled(true);
          setIsHypergraphView(true);
        } else {
          console.warn('Hypergraph creation returned no result');
          setHypergraphEnabled(false);
          setIsHypergraphView(false);
        }
      } catch (error) {
        console.error('Failed to create hypergraph:', error);
        setHypergraphEnabled(false);
        setIsHypergraphView(false);
      }
    } else {
      // Switch back to normal view
      setHypergraphEnabled(false);
      setIsHypergraphView(false);
    }
  };

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
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'analysis', label: 'AI Analysis', icon: '🧠' }
  ];

  return (
    <div className={`min-h-screen bg-background text-foreground ${theme}`}>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRightPanel}
              title="Toggle right panel"
            >
              {rightPanelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Top Status Bar */}
      <TopStatusBar 
        graphData={graphData} 
        currentAOP={currentAOP}
        visibleNodes={visibleNodes}
        visibleEdges={visibleEdges}
      />

      <div className="flex h-[calc(100vh-140px)] bg-background">
        {/* Left Resizable Sidebar */}
        {sidebarOpen && (
          <ResizablePanel 
            side="left" 
            initialWidth={320}
            minWidth={250}
            maxWidth={500}
            className="border-r bg-card"
          >
            <div className="h-full overflow-y-auto p-4">
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
                layoutType={layoutType}
                onLayoutChange={handleLayoutChange}
                communityMethod={communityMethod}
                onCommunityDetection={handleCommunityDetection}
              />
            </div>
          </ResizablePanel>
        )}

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Graph Area */}
          <div className="flex-1 p-4">
            <Card className="h-full">
              {isHypergraphView && hypergraphEnabled && (graphData?.nodes?.length > 0 || hypergraphData?.nodes?.length > 0) ? (
                <ErrorBoundary>
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
                </ErrorBoundary>
              ) : (
                <NetworkGraph
                  data={graphData}
                  onNodeSelect={handleNodeSelect}
                  onEdgeSelect={handleEdgeSelect}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  theme={theme}
                  searchPanelRef={searchPanelRef}
                  onVisibleNodesChange={(nodes, edges) => {
                    setVisibleNodes(nodes);
                    setVisibleEdges(edges);
                  }}
                />
              )}
            </Card>
          </div>

          {/* Right Resizable Panel */}
          {rightPanelOpen && (
            <ResizablePanel 
              side="right" 
              initialWidth={350}
              minWidth={250}
              maxWidth={500}
              className="border-l bg-card"
            >
              <div className="h-full overflow-y-auto">
                {/* Tab Navigation */}
                <div className="flex border-b bg-muted/50">
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
                    onClick={() => setActiveRightTab('chat')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeRightTab === 'chat'
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Chat
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

                {/* Tab Content */}
                <div className="p-4">
                  {activeRightTab === 'details' && (
                    <NodeDetailsPanel 
                      selectedNode={selectedNode} 
                      selectedEdge={selectedEdge}
                      graphData={isHypergraphView ? hypergraphData : graphData}
                    />
                  )}
                  {activeRightTab === 'chat' && (
                    <ChatPanel 
                      graphData={isHypergraphView ? hypergraphData : graphData}
                      selectedNode={selectedNode}
                    />
                  )}
                  {activeRightTab === 'analysis' && (
                    <PerplexityAnalysisPanel 
                      graphData={isHypergraphView ? hypergraphData : graphData}
                      selectedNode={selectedNode}
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>
          )}
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
