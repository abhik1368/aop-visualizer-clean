import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Moon, Sun, Menu, X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import NetworkGraph from './components/NetworkGraph';
import UnifiedControlPanel from './components/UnifiedControlPanel';
import PathVisualizationPanel from './components/PathVisualizationPanel';
import RelationshipAnalyzer from './components/RelationshipAnalyzer';
import './App.css';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [controlPanelOpen, setControlPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState('paths'); // 'paths', 'analyzer'
  const [currentAOP, setCurrentAOP] = useState('');
  const [selectedNodeChain, setSelectedNodeChain] = useState([]);
  const [pathResults, setPathResults] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
    const handlePathsUpdate = useCallback((pathData) => {
    setNodePathData(pathData);
    
    // Auto switch to paths tab when paths are calculated
    if (pathData.selectedNodePaths && pathData.selectedNodePaths.length > 0) {
      setRightPanelTab('paths');
    }
  }, []);

  // Find paths between nodes
  const [nodePathData, setNodePathData] = useState({
    selectedNodePaths: [],
    isCalculatingPaths: false,
    pathsForNode: null
  });
  
  // Panel sizing state
  const [leftPanelWidth, setLeftPanelWidth] = useState(320); // 80 * 4 = 320px (w-80)
  const [rightPanelWidth, setRightPanelWidth] = useState(400); // Increased default width
  const [isResizing, setIsResizing] = useState(null);
  
  const searchPanelRef = useRef(null);
  const containerRef = useRef(null);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  // Load initial sample data
  useEffect(() => {
    // Create sample AOP data for testing
    const sampleData = {
      nodes: [
        {
          id: 'MIE_1',
          label: 'Binding to estrogen receptor',
          type: 'MolecularInitiatingEvent',
          title: 'Estrogen receptor binding event'
        },
        {
          id: 'KE_1',
          label: 'Increased transcription',
          type: 'KeyEvent',
          title: 'Transcriptional activation'
        },
        {
          id: 'KE_2',
          label: 'Cell proliferation',
          type: 'KeyEvent',
          title: 'Cellular proliferation event'
        },
        {
          id: 'AO_1',
          label: 'Breast cancer',
          type: 'AdverseOutcome',
          title: 'Breast carcinogenesis'
        }
      ],
      edges: [
        {
          source: 'MIE_1',
          target: 'KE_1',
          relationship: 'leads_to'
        },
        {
          source: 'KE_1',
          target: 'KE_2',
          relationship: 'leads_to'
        },
        {
          source: 'KE_2',
          target: 'AO_1',
          relationship: 'leads_to'
        }
      ]
    };

    console.log('Loading sample AOP data:', sampleData);
    setGraphData(sampleData);
    setCurrentAOP('Sample AOP - Estrogen Receptor Pathway');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Resizable panel handlers
  const handleMouseDown = useCallback((panel) => {
    setIsResizing(panel);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const minPanelWidth = 200;
    const maxPanelWidth = Math.floor(containerRect.width * 0.6); // Limit to 60% to keep graph visible
    const leftPanelCurrentWidth = sidebarOpen ? leftPanelWidth : 0;
    
    if (isResizing === 'left') {
      const newWidth = Math.max(minPanelWidth, Math.min(maxPanelWidth, e.clientX - containerRect.left));
      setLeftPanelWidth(newWidth);
    } else if (isResizing === 'right') {
      const rightEdge = containerRect.right - e.clientX;
      const maxRightWidth = Math.floor(containerRect.width - leftPanelCurrentWidth - 300); // Ensure 300px min for graph
      const newWidth = Math.max(minPanelWidth, Math.min(maxRightWidth, rightEdge));
      setRightPanelWidth(newWidth);
    }
  }, [isResizing, leftPanelWidth, sidebarOpen]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleAOPSelect = async (aopNameOrData, displayName) => {
    console.log('App handleAOPSelect called with:', { aopNameOrData, displayName });
    setIsLoading(true);
    
    // Reset all state when loading new graph data
    setSelectedNode(null);
    setSelectedEdge(null);
    setPathResults(null);
    setNodePathData({
      selectedNodePaths: [],
      isCalculatingPaths: false,
      pathsForNode: null
    });
    
    try {
      // Check if it's already combined data (multi-AOP) or single AOP name
      if (typeof aopNameOrData === 'object' && aopNameOrData.nodes) {
        // It's already combined data from multi-AOP selection
        console.log('Combined AOP data received:', { nodes: aopNameOrData?.nodes?.length, edges: aopNameOrData?.edges?.length });
        setGraphData(aopNameOrData);
        setCurrentAOP(displayName || 'Multiple AOPs');
      } else {
        // It's a single AOP name
        const response = await fetch(`http://localhost:5001/aop_graph?aop=${aopNameOrData}`);
        const data = await response.json();
        console.log('Single AOP data received:', { nodes: data?.nodes?.length, edges: data?.edges?.length });
        setGraphData(data);
        setCurrentAOP(aopNameOrData);
      }
      
      console.log('Graph data updated in App state');
    } catch (error) {
      console.error('Error fetching AOP data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePathFind = async (params) => {
    console.log('Path finding with params:', params);
    setIsLoading(true);
    try {
      const endpoint = params.type === 'shortest' 
        ? 'unified_shortest_path' 
        : 'unified_k_shortest_paths';
      
      const queryParams = new URLSearchParams({
        source: params.source,
        target: params.target,
        bidirectional: params.bidirectional || false
      });
      
      if (params.type === 'k_shortest') {
        queryParams.append('k', params.k);
      }

      const response = await fetch(`http://localhost:5001/${endpoint}?${queryParams}`);
      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      setPathResults(data);
      
      // Switch to paths tab when path results are found
      if (data.paths && data.paths.length > 0) {
        setRightPanelTab('paths');
      } else if (data.path) {
        setRightPanelTab('paths');
      }
      
      // Update graph to show path results
      if (params.type === 'shortest' && data.path) {
        // For shortest path, create graph with path nodes and edges
        const pathGraphData = {
          nodes: data.nodes || [],
          edges: data.edges || []
        };
        setGraphData(pathGraphData);
        setCurrentAOP(`${params.bidirectional ? 'Bidirectional ' : ''}Path: ${params.source} → ${params.target}`);
      } else if (params.type === 'k_shortest' && data.paths) {
        // For k-shortest paths, use the combined graph from backend
        if (data.combined_graph) {
          setGraphData(data.combined_graph);
          setCurrentAOP(`${data.count} ${params.bidirectional ? 'Bidirectional ' : ''}Paths: ${params.source} → ${params.target} (K=${data.k})`);
        } else {
          // Fallback: combine all path nodes and edges (old method)
          const allNodes = new Map();
          const allEdges = [];
          
          data.paths.forEach(path => {
            path.nodes.forEach(node => {
              allNodes.set(node.id, node);
            });
            allEdges.push(...path.edges);
          });
          
          const pathGraphData = {
            nodes: Array.from(allNodes.values()),
            edges: allEdges
          };
          setGraphData(pathGraphData);
          setCurrentAOP(`${data.count} ${params.bidirectional ? 'Bidirectional ' : ''}Paths: ${params.source} → ${params.target}`);
        }
      }
      
    } catch (error) {
      console.error('Error finding paths:', error);
      alert('Error finding paths. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisResult = (results) => {
    setAnalysisResults(results);
    setRightPanelTab('analyzer');
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (node) {
      setRightPanelTab('analyzer');
    }
  };

  const handleEdgeSelect = (edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    if (edge) {
      setRightPanelTab('analyzer');
    }
  };

  const handleNodeChainUpdate = (nodeChain) => {
    setSelectedNodeChain(nodeChain);
  };

  const rightPanelTabs = [
    { id: 'paths', label: 'Paths', icon: '🛤️' },
    { id: 'analyzer', label: 'Analyzer', icon: '🔬' }
  ];

  return (
    <div>
      {/* Debug test element */}
      <div className="test-visible">
        <h1>AOP Visualizer Debug - If you can see this, React is working!</h1>
        <p>Current AOP: {currentAOP}</p>
        <p>Graph Data: {graphData?.nodes?.length || 0} nodes, {graphData?.edges?.length || 0} edges</p>
        <p>Theme: {theme}</p>
      </div>
      
      <div className={`min-h-screen bg-background text-foreground ${theme}`}>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
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
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]" ref={containerRef}>
        {/* Left Sidebar */}
        <div 
          className={`${sidebarOpen ? 'block' : 'hidden'} border-r border-border bg-card/50 backdrop-blur-sm relative`}
          style={{ width: sidebarOpen ? `${leftPanelWidth}px` : '0px' }}
        >
          <div className="p-4 h-full overflow-y-auto">
            <Collapsible open={controlPanelOpen} onOpenChange={setControlPanelOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between mb-3 hover:bg-accent/50"
                  size="sm"
                >
                  <span className="font-medium">Control Panel</span>
                  {controlPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <UnifiedControlPanel
                  ref={searchPanelRef}
                  onAOPSelect={handleAOPSelect}
                  onPathFind={handlePathFind}
                  selectedAOP={currentAOP}
                  pathResults={pathResults}
                  isLoading={isLoading}
                  onPathResults={(results) => {
                    setPathResults(results);
                    setRightPanelTab('paths');
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          {/* Left resize handle */}
          {sidebarOpen && (
            <div
              className={`absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-primary/20 transition-all duration-200 flex items-center justify-center group ${
                isResizing === 'left' ? 'bg-primary/30' : 'bg-transparent'
              }`}
              onMouseDown={() => handleMouseDown('left')}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-w-0">
          {/* Graph Area */}
          <div 
            className="p-4 bg-background flex-1 min-w-0"
            style={{ 
              width: `calc(100% - ${rightPanelWidth}px)`,
              maxWidth: `calc(100% - ${rightPanelWidth}px)`
            }}
          >
            <Card className="h-full shadow-sm border-border/50 w-full">
              <NetworkGraph
                data={graphData}
                onNodeSelect={handleNodeSelect}
                onEdgeSelect={handleEdgeSelect}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                theme={theme}
                searchPanelRef={searchPanelRef}
                onPathsUpdate={handlePathsUpdate}
              />
            </Card>
          </div>

          {/* Right Panel */}
          <div 
            className="border-l border-border bg-card/50 backdrop-blur-sm relative shadow-lg flex flex-col"
            style={{ width: `${rightPanelWidth}px`, minWidth: `${rightPanelWidth}px`, maxWidth: `${rightPanelWidth}px` }}
          >
            {/* Right resize handle */}
            <div
              className={`absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-primary/20 transition-all duration-200 flex items-center justify-center group z-10 ${
                isResizing === 'right' ? 'bg-primary/30' : 'bg-transparent'
              }`}
              onMouseDown={() => handleMouseDown('right')}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-border/50 bg-card/80 flex-shrink-0" style={{ marginLeft: '8px' }}>
              {rightPanelTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id)}
                  className={`flex-1 p-3 text-sm font-medium transition-all duration-200 min-w-0 ${
                    rightPanelTab === tab.id
                      ? 'bg-background text-foreground border-b-2 border-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-4 overflow-y-auto bg-background/95" style={{ marginLeft: '8px' }}>
              {rightPanelTab === 'paths' && (
                <PathVisualizationPanel
                  pathResults={pathResults}
                  nodePathData={nodePathData}
                  onPathHighlight={(pathIndex) => {
                    console.log('Highlighting path:', pathIndex);
                    // TODO: Implement path highlighting in NetworkGraph
                  }}
                />
              )}

              {rightPanelTab === 'analyzer' && (
                <RelationshipAnalyzer
                  nodes={graphData.nodes || []}
                  onAnalysisResult={handleAnalysisResult}
                />
              )}
            </div>
          </div>
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
    </div>
  );
}

export default App;
