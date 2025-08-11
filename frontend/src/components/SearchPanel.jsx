import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Search, X, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { getApiUrl } from '../config';
import API_BASE_URL from '../config';

// Searchable Node Select Component
const SearchableNodeSelect = ({ value, onChange, nodes, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState(nodes);

  useEffect(() => {
    setFilteredNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = nodes.filter(node => 
        node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredNodes(filtered.slice(0, 100)); // Limit to 100 results for performance
    } else {
      setFilteredNodes(nodes.slice(0, 100)); // Show first 100 nodes by default
    }
  }, [searchTerm, nodes]);

  const selectedNode = nodes.find(node => node.id === value);
  const displayValue = selectedNode ? `${selectedNode.label} (${selectedNode.type})` : '';

  const handleSelect = (nodeId) => {
    onChange(nodeId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    setIsOpen(true);
    
    // Allow direct typing - if user types something that matches a node exactly, select it
    const exactMatch = nodes.find(node => 
      node.label.toLowerCase() === inputValue.toLowerCase() ||
      `${node.label} (${node.type})`.toLowerCase() === inputValue.toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filteredNodes.length > 0) {
      handleSelect(filteredNodes[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full p-2 text-xs border border-border rounded-md bg-background text-foreground pr-8"
        />
        <ChevronDown 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {searchTerm && filteredNodes.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground">
              No nodes found matching "{searchTerm}". Try typing part of the node name.
            </div>
          )}
          {!searchTerm && nodes.length > 100 && (
            <div className="p-2 text-xs text-muted-foreground bg-yellow-50 border-b">
              Showing first 100 nodes. Type to search through all {nodes.length} nodes.
            </div>
          )}
          {filteredNodes.length > 0 && filteredNodes.map(node => (
            <div
              key={node.id}
              onClick={() => handleSelect(node.id)}
              className="p-2 text-xs hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
            >
              <div className="font-medium">{node.label}</div>
              <div className="text-muted-foreground">
                {node.type} • ID: {node.id}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

const SearchPanel = forwardRef(({ 
  onAOPSelect, 
  onNodeSelect, 
  onSearchResults, 
  onDataUpdate,
  graphData, 
  onNodeChainUpdate,
  hypergraphEnabled = false,
  onHypergraphToggle,
  minNodes = 4,
  onMinNodesChange,
  maxNodesPerHypernode = 4,
  onMaxNodesPerHypernodeChange,
  communityMethod = 'louvain',
  onCommunityDetection,
  onAnalysisModeChange
  // Removed nodeGroupingEnabled and onNodeGrouping props as redundant with hypergraph toggle
}, ref) => {
  const [aops, setAops] = useState([]);
  const [selectedAOPs, setSelectedAOPs] = useState([]);
  const [selectedAOP, setSelectedAOP] = useState(''); // Keep for single select compatibility
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Search mode states
  const [searchMode, setSearchMode] = useState('aop'); // 'aop' or 'keyEvent'
  const [keyEventSearch, setKeyEventSearch] = useState('');
  const [keyEventResults, setKeyEventResults] = useState([]);
  const [keyEventLoading, setKeyEventLoading] = useState(false);
  
  // KE/MIE multi-select states
  const [availableKEMIETerms, setAvailableKEMIETerms] = useState([]);
  const [selectedKEMIETerms, setSelectedKEMIETerms] = useState([]);
  const [isGeneratingNetwork, setIsGeneratingNetwork] = useState(false);
  const [keMieSearchTerm, setKeMieSearchTerm] = useState('');
  const [keMieSearchOpen, setKeMieSearchOpen] = useState(false);
  const [filteredKEMIETerms, setFilteredKEMIETerms] = useState([]);
  
  // AOP search states
  const [aopSearchTerm, setAopSearchTerm] = useState('');
  const [filteredAOPs, setFilteredAOPs] = useState([]);
  const [aopSearchOpen, setAopSearchOpen] = useState(false);
  
  // Path finding states
  const [sourceNode, setSourceNode] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [availableNodes, setAvailableNodes] = useState([]);
  const [selectedNodeChain, setSelectedNodeChain] = useState([]);
  const [topKPaths, setTopKPaths] = useState(3);
  const [shortestPathResults, setShortestPathResults] = useState(null);
  const [pathfindingLoading, setPathfindingLoading] = useState(false);
  const [pathfindingError, setPathfindingError] = useState(null);
  const [databaseStats, setDatabaseStats] = useState(null);

  useEffect(() => {
    loadAOPs();
    loadKEMIETerms();
  }, []); // Load initial data on mount
  

  const getApiUrl = (path, params = {}) => {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    return url.toString();
  };

  const loadAOPs = async () => {
    try {
      const response = await fetch(getApiUrl('/aops_detailed'));
      const data = await response.json();
      setAops(data);
      setFilteredAOPs(data);
    } catch (error) {
      console.error('Error loading AOPs:', error);
      // Fallback to simple AOP list
      try {
        const fallbackResponse = await fetch(getApiUrl('/aops'));
        const fallbackData = await fallbackResponse.json();
        const aopObjects = fallbackData.map(aop => ({
          id: aop,
          name: `AOP ${aop}`,
          title: `AOP ${aop}`,
          description: `Adverse Outcome Pathway ${aop}`
        }));
        setAops(aopObjects);
        setFilteredAOPs(aopObjects);
      } catch (fallbackError) {
        console.error('Error loading fallback AOPs:', fallbackError);
      }
    }
  };

  // Load available KE/MIE terms for multi-select
  const loadKEMIETerms = async () => {
    try {
      const apiUrl = getApiUrl('/get_ke_mie_terms');
      console.log('🔍 Loading KE/MIE terms from:', apiUrl);
      console.log('🔍 API_BASE_URL:', API_BASE_URL);
      
      const response = await fetch(apiUrl);
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch KE/MIE terms. Status:', response.status);
        console.error('❌ Error response:', errorText);
        return;
      }
      
      const data = await response.json();
      console.log('📦 KE/MIE API response:', data);
      console.log('✅ Response success:', data.success);
      console.log('📊 Terms array:', data.terms);
      console.log('🔢 Terms count:', data.terms ? data.terms.length : 0);
      
      if (data.success && data.terms && Array.isArray(data.terms)) {
        // Format terms with id, label, and type
        const formattedTerms = data.terms.map(term => ({
          id: term.id,
          label: term.name || term.label,
          type: term.type // Should be 'KeyEvent', 'MolecularInitiatingEvent', or 'AdverseOutcome'
        }));
        console.log('✨ Formatted KE/MIE terms:', formattedTerms.length, 'terms loaded');
        console.log('🎯 Sample terms:', formattedTerms.slice(0, 5));
        console.log('📈 Type distribution:', formattedTerms.reduce((acc, term) => {
          acc[term.type] = (acc[term.type] || 0) + 1;
          return acc;
        }, {}));
        setAvailableKEMIETerms(formattedTerms);
      } else {
        console.warn('⚠️ KE/MIE API response not successful or missing terms:', data);
        console.warn('⚠️ Expected: data.success=true and data.terms as array');
        console.warn('⚠️ Got success:', data.success, 'terms type:', typeof data.terms, 'is array:', Array.isArray(data.terms));
      }
    } catch (error) {
      console.error('💥 Error loading KE/MIE terms:', error);
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  };

  // Filter AOPs based on search term
  const filterAOPs = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredAOPs(aops);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = aops.filter(aop => {
      const aopId = (aop.id || aop.name || aop).toString().toLowerCase();
      const aopTitle = (aop.title || aop.name || aop).toLowerCase();
      const aopDescription = (aop.description || '').toLowerCase();
      
      return aopId.includes(term) || 
             aopTitle.includes(term) || 
             aopDescription.includes(term);
    });
    
    setFilteredAOPs(filtered.slice(0, 20)); // Limit to 20 results for performance
  };

  // Handle AOP search input
  const handleAOPSearch = (e) => {
    const value = e.target.value;
    setAopSearchTerm(value);
    filterAOPs(value);
    setAopSearchOpen(true);
  };

  const loadMultipleAOPGraphs = async (aopList) => {
    console.log('loadMultipleAOPGraphs called with:', aopList);
    setLoading(true);
    try {
      const promises = aopList.map(async (aop) => {
        const url = getApiUrl('/aop_graph', { aop });
        const response = await fetch(url);
        return await response.json();
      });
      
      const results = await Promise.all(promises);
      
      // Combine all graphs into one
      const combinedNodes = [];
      const combinedEdges = [];
      const nodeIds = new Set();
      
      results.forEach((data, index) => {
        if (data.nodes) {
          data.nodes.forEach(node => {
            if (!nodeIds.has(node.id)) {
              nodeIds.add(node.id);
              combinedNodes.push({
                ...node,
                aop_source: aopList[index] // Track which AOP this node came from
              });
            }
          });
        }
        {/* Node Chain Selection */}
        {selectedNodeChain.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-semibold">Selected Node Chain</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={clearNodeChain}
                className="text-xs"
              >
                Clear Chain
              </Button>
            </div>
            <div className="space-y-1">
              {selectedNodeChain.map((nodeId, index) => {
                const node = availableNodes.find(n => n.id === nodeId);
                return (
                  <div key={nodeId} className="flex items-center justify-between bg-muted p-2 rounded text-xs">
                    <span>{index + 1}. {node?.label || nodeId} ({node?.type})</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromNodeChain(nodeId)}
                      className="h-4 w-4 p-0"
                    >
                      ×
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        if (data.edges) {
          data.edges.forEach(edge => {
            combinedEdges.push({
              ...edge,
              aop_source: aopList[index] // Track which AOP this edge came from
            });
          });
        }
      });
      
      const combinedData = {
        nodes: combinedNodes,
        edges: combinedEdges
      };
      
      console.log('Combined data:', combinedData);
      onAOPSelect && onAOPSelect(combinedData, aopList.join(', '));
      console.log('onAOPSelect called with combined data');
    } catch (error) {
      console.error('Error loading multiple AOP graphs:', error);
      onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
    } finally {
      setLoading(false);
    }
  };

  // Load network for comprehensive search results
  const loadNetworkForSearch = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    console.log('🔄 Starting network load for:', searchTerm);
    setKeyEventLoading(true);
    
    try {
      const url = getApiUrl('/search_key_events', { 
        query: searchTerm.trim(),
        limit: 100,
        complete_pathways: 'true'
      });
      console.log('API URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Full API Response:', data);
      
      if (data.success) {
        console.log('graph_data value:', data.graph_data);
        console.log('graph_data type:', typeof data.graph_data);
        
        if (data.graph_data && data.graph_data !== null) {
          const metadata = data.graph_data.metadata || {};
          const stats = metadata.stats || {};
          
          console.log('✅ Network data found!');
          console.log('Network stats:', {
            nodes: data.graph_data.nodes?.length || 0,
            edges: data.graph_data.edges?.length || 0,
            aop_count: stats.aop_count || 0,
            direct_matches: stats.direct_matches || 0
          });
          
          const networkTitle = `Complete AOP Pathways: "${searchTerm}" (${stats.aop_count || 0} AOPs, ${stats.direct_matches || 0} direct matches)`;
          
          if (onAOPSelect) {
            console.log('🔄 Calling onAOPSelect with title:', networkTitle);
            onAOPSelect(data.graph_data, networkTitle);
            console.log('✅ Network load command sent successfully!');
          } else {
            console.error('❌ onAOPSelect callback not available!');
          }
        } else {
          console.warn('⚠️ graph_data is null or undefined');
          console.log('graph_data value:', data.graph_data);
          console.log('Available data keys:', Object.keys(data));
          console.log('Search metadata:', data.search_metadata);
          console.log('Total matches:', data.total_matches);
          console.log('Matching AOPs:', data.matching_aops);
        }
      } else {
        console.error('❌ API returned success: false');
        console.log('Error:', data.error);
      }
    } catch (error) {
      console.error('❌ Network loading error:', error);
    } finally {
      setKeyEventLoading(false);
      console.log('🏁 Network loading finished');
    }
  };

  // Enhanced Key Event Search Function (for finding results only)
  const searchKeyEvents = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setKeyEventResults([]);
      return;
    }

    setKeyEventLoading(true);
    try {
      const response = await fetch(getApiUrl('/search_key_events', { 
        query: searchTerm.trim(),
        limit: 100,
        complete_pathways: 'false'  // Just get results, don't generate network yet
      }));
      const data = await response.json();
      
      if (data.success) {
        setKeyEventResults(data.results || []);
        
        console.log('🔍 Search Results Found:', {
          query: data.query,
          total_matches: data.total_matches,
          total_aops: data.total_aops
        });
      } else {
        console.error('Search failed:', data.error);
        setKeyEventResults([]);
      }
    } catch (error) {
      console.error('Error in search:', error);
      setKeyEventResults([]);
    } finally {
      setKeyEventLoading(false);
    }
  };

  // Handle key event search input
  const handleKeyEventSearch = (e) => {
    const value = e.target.value;
    setKeyEventSearch(value);
    
    // Debounce search
    clearTimeout(window.keyEventSearchTimeout);
    window.keyEventSearchTimeout = setTimeout(() => {
      searchKeyEvents(value);
    }, 500);
  };

  // KE/MIE search and selection handlers
  const handleKEMIESearch = (e) => {
    const searchTerm = e.target.value;
    setKeMieSearchTerm(searchTerm);
    
    if (searchTerm.trim()) {
      const filtered = availableKEMIETerms.filter(term => 
        term.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredKEMIETerms(filtered.slice(0, 50)); // Limit to 50 results
      setKeMieSearchOpen(true);
    } else {
      setFilteredKEMIETerms([]);
      setKeMieSearchOpen(false);
    }
  };

  const addKEMIETermToSelection = (term) => {
    if (!selectedKEMIETerms.includes(term.id)) {
      setSelectedKEMIETerms([...selectedKEMIETerms, term.id]);
    }
    setKeMieSearchOpen(false);
    setKeMieSearchTerm('');
  };

  const removeKEMIETermFromSelection = (termId) => {
    setSelectedKEMIETerms(prev => prev.filter(id => id !== termId));
  };

  const clearKEMIESelection = () => {
    setSelectedKEMIETerms([]);
  };

  // Generate network from selected KE/MIE terms
  const generateKEMIENetwork = async () => {
    if (selectedKEMIETerms.length === 0) return;

    setIsGeneratingNetwork(true);
    try {
      const response = await fetch(getApiUrl('/generate_ke_mie_network'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term_ids: selectedKEMIETerms,
          unique_nodes: true // Ensure unique nodes
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.graph_data) {
        const selectedTermLabels = selectedKEMIETerms.map(termId => {
          const term = availableKEMIETerms.find(t => t.id === termId);
          return term ? term.label : termId;
        }).join(', ');
        
        console.log('Generated KE/MIE network:', data.graph_data);
        onAOPSelect && onAOPSelect(data.graph_data, `KE/MIE Network: ${selectedTermLabels}`);
      } else {
        console.error('Failed to generate KE/MIE network:', data.error);
      }
    } catch (error) {
      console.error('Error generating KE/MIE network:', error);
    } finally {
      setIsGeneratingNetwork(false);
    }
  };

  const handleMultiAOPSelection = (aopObj) => {
    const aopId = aopObj.id || aopObj.name || aopObj;
    console.log('Multi-AOP selection triggered:', aopId);
    
    let newSelection;
    const currentIds = selectedAOPs.map(a => a.id || a.name || a);
    
    if (currentIds.includes(aopId)) {
      newSelection = selectedAOPs.filter(selected => {
        const selectedId = selected.id || selected.name || selected;
        return selectedId !== aopId;
      });
    } else {
      newSelection = [...selectedAOPs, aopObj];
    }
    
    setSelectedAOPs(newSelection);
    
    if (newSelection.length > 0) {
      const aopIds = newSelection.map(a => a.id || a.name || a);
      loadMultipleAOPGraphs(aopIds);
    } else {
      onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
    }
  };

  // Add AOP to selection from search
  const addAOPToSelection = (aopObj) => {
    const aopId = aopObj.id || aopObj.name || aopObj;
    const currentIds = selectedAOPs.map(a => a.id || a.name || a);
    
    if (!currentIds.includes(aopId)) {
      handleMultiAOPSelection(aopObj);
    }
    setAopSearchTerm('');
    setAopSearchOpen(false);
  };

  // Remove AOP from selection
  const removeAOPFromSelection = (aopObj) => {
    handleMultiAOPSelection(aopObj);
  };

  const loadAOPGraph = async (aop) => {
    console.log('loadAOPGraph called with:', aop);
    setLoading(true);
    try {
      const url = getApiUrl('/aop_graph', { aop });
      console.log('Fetching from URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('API response data:', data);
      onAOPSelect && onAOPSelect(data, aop);
      console.log('onAOPSelect called with data:', data);
    } catch (error) {
      console.error('Error loading AOP graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(getApiUrl('/search', { 
        q: searchQuery, 
        by: searchFilter 
      }));
      const data = await response.json();
      setSearchResults(data);
      onSearchResults && onSearchResults(data);
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAOPSelection = async (aop) => {
    console.log('AOP Selection triggered:', aop);
    setSelectedAOP(aop);
    if (aop) {
      console.log('Loading AOP graph for:', aop);
      await loadAOPGraph(aop);
    }
  };

  const handleResultClick = (result) => {
    if (result.type === 'aop') {
      handleAOPSelection(result.value);
    } else if (result.type === 'node') {
      // First load the AOP, then highlight the node
      handleAOPSelection(result.aop);
      setTimeout(() => {
        onNodeSelect && onNodeSelect(result);
      }, 500);
    }
    setSearchResults([]); // Changed from setResults to setSearchResults
    setSearchQuery('');
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]); // Changed from setResults to setSearchResults
    onSearchResults && onSearchResults([]);
  };

  const searchTypes = [
    { value: 'all', label: 'All' },
    { value: 'aop', label: 'AOPs' },
    { value: 'mie', label: 'MIE' },
    { value: 'ke', label: 'Key Events' },
    { value: 'ao', label: 'Adverse Outcomes' }
  ];

  // Added useEffect to load AOPs on component mount
  useEffect(() => {
    loadAOPs();
    loadKEMIETerms(); // Load KE/MIE terms for multi-select
  }, []);

  // Update available nodes when graph data changes
  useEffect(() => {
    if (graphData && graphData.nodes) {
      const nodes = graphData.nodes.map(node => ({
        id: node.id,
        label: node.label || node.id,
        type: node.type
      }));
      setAvailableNodes(nodes);
    }
  }, [graphData]);

  // Notify parent when node chain changes
  useEffect(() => {
    if (onNodeChainUpdate) {
      onNodeChainUpdate(selectedNodeChain);
    }
  }, [selectedNodeChain, onNodeChainUpdate]);

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    addToNodeChain,
    removeFromNodeChain,
    clearNodeChain,
    getSelectedNodeChain: () => selectedNodeChain
  }));

  // Path finding functions
  const findBothPathTypes = async () => {
    if (!sourceNode || !targetNode) {
      setPathfindingError('Please select both source and target nodes');
      return;
    }
    
    setPathfindingLoading(true);
    setPathfindingError(null);
    setShortestPathResults(null);
    setLongestPathResults(null);
    
    try {
      // Search for shortest paths
      const shortestParams = new URLSearchParams({
        source: sourceNode,
        target: targetNode,
        k: topKPaths.toString(),
        type: 'shortest',
        full_database: 'true'
      });
      const shortestUrl = `${API_BASE_URL}/custom_path_search?${shortestParams}`;
      const shortestResponse = await fetch(shortestUrl);
      const shortestData = await shortestResponse.json();
      
      // Search for longest paths
      const longestParams = new URLSearchParams({
        source: sourceNode,
        target: targetNode,
        k: topKPaths.toString(),
        type: 'longest',
        full_database: 'true'
      });
      const longestUrl = `${API_BASE_URL}/custom_path_search?${longestParams}`;
      const longestResponse = await fetch(longestUrl);
      const longestData = await longestResponse.json();
      
      // Handle results
      if (shortestData.error && longestData.error) {
        setPathfindingError(`No paths found: ${shortestData.error}`);
        return;
      }
      
      if (!shortestData.error && shortestData.paths && shortestData.paths.length > 0) {
        setShortestPathResults(shortestData);
        console.log('Shortest paths found:', shortestData);
      }
      
      if (!longestData.error && longestData.paths && longestData.paths.length > 0) {
        setLongestPathResults(longestData);
        console.log('Longest paths found:', longestData);
      }
      
      // If no paths found in either search
      if ((!shortestData.paths || shortestData.paths.length === 0) && 
          (!longestData.paths || longestData.paths.length === 0)) {
        setPathfindingError('No paths found between the selected nodes');
      }
      
    } catch (error) {
      console.error('Error finding paths:', error);
      setPathfindingError('Failed to find paths. Please try again.');
    } finally {
      setPathfindingLoading(false);
    }
  };

  const clearPathResults = () => {
    setShortestPathResults(null);
    setPathfindingError(null);
  };

  // Individual pathfinding function
  const findShortestPaths = async () => {
    if (!sourceNode || !targetNode) {
      setPathfindingError('Please select both source and target nodes');
      return;
    }
    
    setPathfindingLoading(true);
    setPathfindingError(''); // Clear any previous errors immediately
    setShortestPathResults(null);
    
    try {
      const params = new URLSearchParams({
        source: sourceNode,
        target: targetNode,
        k: topKPaths.toString(),
        type: 'shortest',
        full_database: 'true'
      });
      const url = `${API_BASE_URL}/custom_path_search?${params}`;
      console.log('Making shortest path request to:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Shortest path response:', data);
      
      if (data.error) {
        setPathfindingError(`No shortest paths found: ${data.error}`);
        return;
      }
      
      if (data.paths && data.paths.length > 0) {
        setShortestPathResults(data);
        setPathfindingError(''); // Clear any previous errors
        console.log('✅ SUCCESS: Shortest paths found:', data);
        console.log('✅ About to generate graph with data:', data);
        // Generate graph visualization
        try {
          generatePathGraph(data, 'shortest');
          console.log('✅ Graph generation completed successfully');
        } catch (graphError) {
          console.error('❌ Error during graph generation:', graphError);
          setPathfindingError('Graph generation failed: ' + graphError.message);
        }
      } else {
        console.log('❌ No paths in response:', data);
        setPathfindingError('No shortest paths found between the selected nodes');
      }
      
    } catch (error) {
      console.error('Error finding shortest paths:', error);
      // Only set error if we don't already have results
      if (!shortestPathResults || !shortestPathResults.paths || shortestPathResults.paths.length === 0) {
        setPathfindingError('Failed to find shortest paths. Please try again.');
      }
    } finally {
      setPathfindingLoading(false);
    }
  };

  // Graph generation for pathfinding results
  const generatePathGraph = (pathData, pathType) => {
    console.log('🎯 Starting generatePathGraph with:', { pathData, pathType });
    
    if (!pathData || !pathData.paths || pathData.paths.length === 0) {
      console.log('❌ No paths to visualize');
      return;
    }

    console.log('🔄 Generating graph from path data:', pathData);

    // Extract all unique nodes and edges from paths
    const nodes = new Set();
    const edges = [];
    const edgeIds = new Set(); // To avoid duplicate edges
    
    pathData.paths.forEach((pathObj, pathIndex) => {
      console.log(`📍 Processing path ${pathIndex}:`, pathObj);
      
      // Handle different path formats - sometimes it's an object with 'path' property
      const path = Array.isArray(pathObj) ? pathObj : (pathObj.path || pathObj);
      
      if (!Array.isArray(path)) {
        console.warn('⚠️ Invalid path format:', pathObj);
        return;
      }
      
      console.log(`📋 Path ${pathIndex} array:`, path);
      
      path.forEach((node, nodeIndex) => {
        nodes.add(node);
        
        // Add edge to next node in path
        if (nodeIndex < path.length - 1) {
          const nextNode = path[nodeIndex + 1];
          const edgeId = `${node}-${nextNode}`;
          
          // Avoid duplicate edges
          if (!edgeIds.has(edgeId)) {
            edges.push({
              source: node,
              target: nextNode,
              pathIndex: pathIndex,
              pathType: pathType
            });
            edgeIds.add(edgeId);
          }
        }
      });
    });

    // Create graph data structure with proper node labels
    const graphData = {
      nodes: Array.from(nodes).map(nodeId => {
        // Try to get node name from the database nodes if available
        let nodeLabel = nodeId;
        let nodeType = 'Unknown';
        
        if (availableNodes && availableNodes.length > 0) {
          const nodeInfo = availableNodes.find(n => n.id === nodeId);
          if (nodeInfo) {
            nodeLabel = nodeInfo.label || nodeInfo.name || nodeId;
            nodeType = nodeInfo.type || nodeInfo.etype || 'Unknown';
          }
        }
        
        return {
          id: nodeId,
          label: nodeLabel,
          name: nodeLabel,
          type: nodeType,
          group: 'shortest_path',
          color: '#3b82f6'
        };
      }),
      edges: edges.map((edge, index) => ({
        id: `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        pathIndex: edge.pathIndex,
        pathType: edge.pathType,
        group: 'shortest_path',
        color: '#3b82f6'
      }))
    };

    console.log(`✅ Generated ${pathType} path graph:`, {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      paths: pathData.paths.length,
      graphData: graphData
    });

    // Update the main graph visualization
    if (onDataUpdate) {
      console.log('📤 Calling onDataUpdate with graph data');
      onDataUpdate(graphData);
      
      // Switch to regular graph view for pathfinding results
      if (onHypergraphToggle) {
        console.log('🔄 Switching to regular graph view');
        onHypergraphToggle(false);
      }
      
      console.log('✅ Graph update completed');
    } else {
      console.warn('❌ onDataUpdate function not available');
    }
  };

  // Load all nodes from complete database for pathfinding
  const loadAllDatabaseNodes = async () => {
    try {
      console.log('Loading all nodes from complete database for pathfinding...');
      const response = await fetch(`${API_BASE_URL}/full_database_nodes`);
      const data = await response.json();
      
      if (data.nodes && data.nodes.length > 0) {
        // Create unique nodes by removing duplicates based on ID
        const uniqueNodes = data.nodes.reduce((acc, node) => {
          if (!acc.find(existing => existing.id === node.id)) {
            acc.push(node);
          }
          return acc;
        }, []);
        
        setAvailableNodes(uniqueNodes);
        
        // Store database statistics
        setDatabaseStats({
          total_nodes: data.total_nodes || uniqueNodes.length,
          node_type_counts: data.node_type_counts || {},
          categorized_counts: data.categorized_counts || {},
          unique_nodes_loaded: uniqueNodes.length
        });
        
        console.log(`✅ Loaded ${uniqueNodes.length} unique nodes from complete AOP database`);
        console.log('🔍 Complete Database Stats:', {
          total_nodes: data.total_nodes,
          node_types: Object.keys(data.node_type_counts || {}),
          mie_nodes: data.node_type_counts?.['MIE'] || 0,
          ao_nodes: data.node_type_counts?.['AO'] || 0
        });
      } else {
        console.error('No nodes returned from database');
        setAvailableNodes([]);
        setDatabaseStats(null);
      }
    } catch (error) {
      console.error('Error loading complete database nodes:', error);
      setAvailableNodes([]);
      setDatabaseStats(null);
    }
  };

  // Load database nodes when pathfinding mode is activated
  useEffect(() => {
    if (searchMode === 'pathFinding') {
      loadAllDatabaseNodes();
    }
  }, [searchMode]);

  const findShortestPath = async () => {
    if (!sourceNode || !targetNode) {
      console.log('Please select both source and target nodes');
      return;
    }
    
    try {
      const currentAOP = multiSelectMode ? selectedAOPs[0] || '' : selectedAOP;
      const url = `${API_BASE_URL}/shortest_path?source=${encodeURIComponent(sourceNode)}&target=${encodeURIComponent(targetNode)}&aop=${encodeURIComponent(currentAOP)}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log('Shortest path result:', data);
      // TODO: Highlight path in the network
    } catch (error) {
      console.error('Error finding shortest path:', error);
    }
  };

  const findKShortestPaths = async (k = 3) => {
    if (!sourceNode || !targetNode) {
      console.log('Please select both source and target nodes');
      return;
    }
    
    try {
      const currentAOP = multiSelectMode ? selectedAOPs[0] || '' : selectedAOP;
      const url = `${API_BASE_URL}/k_shortest_paths?source=${encodeURIComponent(sourceNode)}&target=${encodeURIComponent(targetNode)}&k=${k}&aop=${encodeURIComponent(currentAOP)}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log('K shortest paths result:', data);
      // TODO: Highlight paths in the network
    } catch (error) {
      console.error('Error finding K shortest paths:', error);
    }
  };

  const findAllPossiblePaths = async () => {
    try {
      const currentAOP = multiSelectMode ? selectedAOPs[0] || '' : selectedAOP;
      const url = `${API_BASE_URL}/all_paths?aop=${encodeURIComponent(currentAOP)}&max_paths=10`;
      const response = await fetch(url);
      const data = await response.json();
      console.log('All possible paths result:', data);
      // TODO: Display paths in a modal or side panel
    } catch (error) {
      console.error('Error finding all possible paths:', error);
    }
  };

  // Node chain selection functions
  const addToNodeChain = (nodeId) => {
    if (!selectedNodeChain.includes(nodeId)) {
      setSelectedNodeChain([...selectedNodeChain, nodeId]);
    }
  };

  const removeFromNodeChain = (nodeId) => {
    setSelectedNodeChain(selectedNodeChain.filter(id => id !== nodeId));
  };

  const clearNodeChain = () => {
    setSelectedNodeChain([]);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-3">AOP Network Analysis</h3>
          
          {/* Search Mode Selection */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium mb-2">Analysis Mode</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="aop-mode"
                  name="searchMode"
                  value="aop"
                  checked={searchMode === 'aop'}
                  onChange={(e) => {
                    setSearchMode(e.target.value);
                    onAnalysisModeChange && onAnalysisModeChange();
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="aop-mode" className="text-sm">AOP Selection - Browse complete AOP networks</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="key-event-mode"
                  name="searchMode"
                  value="keyEvent"
                  checked={searchMode === 'keyEvent'}
                  onChange={(e) => {
                    setSearchMode(e.target.value);
                    onAnalysisModeChange && onAnalysisModeChange();
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="key-event-mode" className="text-sm">Comprehensive Pathway Search - Find complete AOP networks by biological terms</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="path-finding-mode"
                  name="searchMode"
                  value="pathFinding"
                  checked={searchMode === 'pathFinding'}
                  onChange={(e) => {
                    setSearchMode(e.target.value);
                    onAnalysisModeChange && onAnalysisModeChange();
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="path-finding-mode" className="text-sm">Path Finding - Analyze connections between nodes</label>
              </div>
            </div>
          </div>
          
          {/* Key Event Search Mode */}
          {searchMode === 'keyEvent' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 flex items-center mb-3">
                  <Search className="w-4 h-4 mr-2 text-blue-500" />
                  Comprehensive AOP Pathway Search
                </h3>
                <div className="text-xs text-muted-foreground mb-3">
                  <strong>Search for biological terms to find complete AOP pathways (MIE→KE→AO)</strong>
                  <br />
                  Examples: "Acetylcholinesterase inhibition", "DNA damage", "oxidative stress", "neurodegeneration"
                  <br />
                  <span className="text-green-600">✨ Enhanced search finds related AOPs and shows complete pathways</span>
                </div>
              </div>
              
              {/* Comprehensive Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={keyEventSearch}
                  onChange={(e) => {
                    setKeyEventSearch(e.target.value);
                    // Debounce search
                    clearTimeout(window.keyEventSearchTimeout);
                    window.keyEventSearchTimeout = setTimeout(() => {
                      searchKeyEvents(e.target.value);
                    }, 800);
                  }}
                  placeholder="Search for biological terms (e.g., 'Acetylcholinesterase inhibition', 'DNA damage', 'neurodegeneration')..."
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground"
                />
                {keyEventLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
              
              {/* Search Results Display */}
              {keyEventResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-medium text-gray-900">
                    🔍 Search Results ({keyEventResults.length} matches found)
                  </div>
                  

                  
                  {/* Top Results Preview */}
                  <div className="max-h-32 overflow-y-auto border border-border rounded-md">
                    {keyEventResults.slice(0, 10).map((result, index) => (
                      <div 
                        key={`${result.id}-${index}-${result.aop || 'unknown'}`} 
                        className="p-2 text-xs border-b border-border last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => {
                          console.log('Loading network for result:', result.label);
                          loadNetworkForSearch(keyEventSearch);
                        }}
                        title="Click to load complete AOP pathways"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{result.label}</div>
                            <div className="text-muted-foreground">
                              {result.type} • {result.aop_title || result.aop}
                            </div>
                          </div>
                          <div className="text-xs">
                            <span className={`px-2 py-1 rounded ${
                              result.type === 'KeyEvent' ? 'bg-blue-100 text-blue-700' :
                              result.type === 'MolecularInitiatingEvent' ? 'bg-green-100 text-green-700' :
                              result.type === 'AdverseOutcome' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {result.type === 'KeyEvent' ? 'KE' :
                               result.type === 'MolecularInitiatingEvent' ? 'MIE' :
                               result.type === 'AdverseOutcome' ? 'AO' : result.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {keyEventResults.length > 10 && (
                      <div className="p-2 text-xs text-center text-muted-foreground bg-muted/30">
                        ... and {keyEventResults.length - 10} more results (all included in network)
                      </div>
                    )}
                  </div>
                </div>
              )}
              

              
              {/* No Results Message */}
              {keyEventResults.length === 0 && !keyEventLoading && keyEventSearch.length > 0 && (
                <div className="mt-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <div className="text-xs text-orange-800">
                      <div className="font-medium mb-1">🔍 No results found for "{keyEventSearch}"</div>
                      <div>Try different terms or check spelling. The search looks in node labels, descriptions, and AOP titles.</div>
                    </div>
                  </div>
                </div>
              )}
              

            </div>
          )}
          
          {/* AOP Selection Mode */}
          {searchMode === 'aop' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Search & Select AOPs</label>
                <div className="text-xs text-muted-foreground mb-2">
                  Search by number (e.g., "431") or keywords (e.g., "liver fibrosis")
                </div>
                
                {/* AOP Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={aopSearchTerm}
                    onChange={handleAOPSearch}
                    onFocus={() => setAopSearchOpen(true)}
                    placeholder="Search AOPs (e.g., '431', 'liver fibrosis', 'oxidative stress')..."
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {aopSearchOpen && filteredAOPs.length > 0 && (
                  <div className="relative">
                    <div className="absolute top-0 left-0 right-0 z-50 max-h-48 overflow-y-auto border border-border rounded-md bg-background shadow-lg">
                      {filteredAOPs.map((aop, index) => {
                        const aopId = aop.id || aop.name || aop;
                        const aopTitle = aop.title || aop.name || aop;
                        const aopDescription = aop.description || '';
                        const currentIds = selectedAOPs.map(a => a.id || a.name || a);
                        const isSelected = currentIds.includes(aopId);
                        
                        return (
                          <div
                            key={aopId}
                            onClick={() => addAOPToSelection(aop)}
                            className={`p-2 text-xs hover:bg-accent cursor-pointer border-b border-border last:border-b-0 ${
                              isSelected ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            <div className="font-medium">{aopTitle}</div>
                            {aopDescription && (
                              <div className="text-muted-foreground mt-1">{aopDescription}</div>
                            )}
                            {isSelected && (
                              <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Selected AOPs */}
                {selectedAOPs.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium mb-2">Selected AOPs ({selectedAOPs.length}):</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {selectedAOPs.map((aop) => {
                        const aopId = aop.id || aop.name || aop;
                        const aopTitle = aop.title || aop.name || aop;
                        return (
                          <div key={aopId} className="flex items-center justify-between bg-blue-50 p-2 rounded text-xs">
                            <span className="font-medium text-blue-700">{aopTitle}</span>
                            <button
                              onClick={() => removeAOPFromSelection(aop)}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAOPs([]);
                        onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
                      }}
                      className="text-xs text-red-500 hover:text-red-700 mt-2"
                    >
                      Clear All Selections
                    </button>
                  </div>
                )}
                
                {/* Overlay to close dropdown when clicking outside */}
                {aopSearchOpen && (
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setAopSearchOpen(false)}
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Path Finding Mode */}
          {searchMode === 'pathFinding' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Path Finding - Analyze connections between nodes</label>
                <div className="text-xs text-muted-foreground mb-3">
                  🌐 <strong>Complete AOP Database Search</strong> - Independent from AOP selection above
                </div>
                
                {/* Database Statistics */}
                {databaseStats && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded mb-3">
                    <div className="text-xs font-medium text-blue-800 mb-1">Complete Database Loaded</div>
                    <div className="text-xs text-blue-700">
                      📊 {databaseStats.unique_nodes_loaded} unique nodes | 
                      🧬 {databaseStats.categorized_counts?.MIE || 0} MIE | 
                      🎯 {databaseStats.categorized_counts?.AO || 0} AO | 
                      🔗 {databaseStats.categorized_counts?.KE || 0} KE nodes
                    </div>
                  </div>
                )}
                
                {pathfindingLoading && !databaseStats && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded mb-3">
                    <div className="text-xs text-yellow-800">🔄 Loading complete AOP database...</div>
                  </div>
                )}
                
                {/* Path Finding Controls */}
                {availableNodes.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Source Node</label>
                        <SearchableNodeSelect
                          value={sourceNode}
                          onChange={setSourceNode}
                          nodes={availableNodes}
                          placeholder="Type or select source..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Target Node</label>
                        <SearchableNodeSelect
                          value={targetNode}
                          onChange={setTargetNode}
                          nodes={availableNodes}
                          placeholder="Type or select target..."
                        />
                      </div>
                    </div>
                    
                    {/* Number of paths input */}
                    <div>
                      <label className="text-xs font-medium mb-1 block">Number of Paths (K)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={topKPaths}
                        onChange={(e) => setTopKPaths(parseInt(e.target.value) || 3)}
                        className="w-full p-2 text-xs border rounded"
                        placeholder="Enter number of paths"
                      />
                    </div>
                    
                    {/* Error Display */}
                    {pathfindingError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded">
                        <div className="text-xs text-red-800">
                          {pathfindingError}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        size="sm"
                        onClick={findShortestPaths}
                        disabled={!sourceNode || !targetNode || pathfindingLoading}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {pathfindingLoading ? '🔍' : '⚡'} Find Shortest Paths
                      </Button>
                    </div>
                    
                    {shortestPathResults && (
                      <div className="space-y-2">
                        <div className="text-xs text-green-600 font-medium">
                          ✅ Paths found and graph generated successfully!
                        </div>
                        
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={clearPathResults}
                            className="text-xs"
                          >
                            Clear Results
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              console.log('Manual graph generation test');
                              if (shortestPathResults) {
                                generatePathGraph(shortestPathResults, 'shortest');
                              }
                            }}
                            className="text-xs"
                          >
                            🔄 Regenerate Graph
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current Selection */}
        {(selectedAOP || selectedAOPs.length > 0) && (
          <div>
            <label className="text-sm font-medium mb-2 block">Current Selection</label>
            {multiSelectMode ? (
              <div className="space-y-1">
                {selectedAOPs.map(aop => (
                  <Badge key={aop} variant="default" className="text-xs mr-1">
                    {aop}
                  </Badge>
                ))}
              </div>
            ) : (
              <Badge variant="default" className="text-sm">
                {selectedAOP}
              </Badge>
            )}
          </div>
        )}



        

        {/* Hypergraph Controls */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-md font-semibold">Hypergraph Analysis</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Enable</span>
              <input
                type="checkbox"
                checked={hypergraphEnabled}
                onChange={(e) => onHypergraphToggle && onHypergraphToggle(e.target.checked)}
                disabled={!graphData || !graphData.nodes || graphData.nodes.length === 0}
                className="w-4 h-4"
              />
            </div>
          </div>
          
          {(!graphData || !graphData.nodes || graphData.nodes.length === 0) && (
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
              📊 <strong>Load Data First:</strong> Select AOPs or search key events to enable hypergraph analysis.
            </div>
          )}
          
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            💡 <strong>Tip:</strong> Hypergraph will use the nodes currently visible in the network panel.
          </div>
          
          {hypergraphEnabled && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              {/* Max Nodes Per Hypernode Slider - DISABLED per user requirement
              <div>
                <label className="text-xs font-medium mb-1 block">
                  Max Nodes per Hypernode: {maxNodesPerHypernode}
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={maxNodesPerHypernode}
                  onChange={(e) => onMaxNodesPerHypernodeChange && onMaxNodesPerHypernodeChange(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Controls when to split type groups into multiple hypernodes
                </div>
              </div> */}
              
              {/* Communities toggle and min nodes */}
              {/* Removed "Use Communities" toggle per user request */}
              <div>
                <label className="text-xs font-medium mb-1 block">
                  Max Nodes per Hypernode
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={minNodes}
                  onChange={(e) => onMinNodesChange && onMinNodesChange(e.target.value)}
                  className="w-full p-1 text-xs"
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  When a group exceeds this number, it will be split into multiple hypernodes of the same type/color.
                </div>
              </div>
              
              {/* Community Detection */}
              <div>
                <label className="text-xs font-medium mb-1 block">Community Method</label>
                <select
                  value={communityMethod}
                  onChange={(e) => onCommunityDetection && onCommunityDetection(e.target.value)}
                  className="w-full p-1 text-xs border border-border rounded bg-background"
                  disabled={true}
                >
                  <option value="louvain">Louvain</option>
                  <option value="leiden">Leiden</option>
                  <option value="walktrap">Walktrap</option>
                  <option value="spectral">Spectral</option>
                </select>
              </div>
              
              {/* Removed "Group nodes by type" toggle - redundant with hypergraph toggle */}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

SearchPanel.displayName = 'SearchPanel';

export default SearchPanel;


