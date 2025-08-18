import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Search, X, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import API_BASE_URL, { getApiUrl } from '../config';

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
  graphData,
  onNodeChainUpdate,
  hypergraphEnabled = false,
  onHypergraphToggle,
  maxNodesPerHypernode = 4,
  onMaxNodesPerHypernodeChange,
  communityMethod = 'louvain',
  onCommunityDetection,
  onLoadingChange
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
  
  // KE/MIE single-select states
  const [availableKEMIETerms, setAvailableKEMIETerms] = useState([]);
  const [selectedKEMIETerms, setSelectedKEMIETerms] = useState([]);
  
  // AOP search states
  const [aopSearchTerm, setAopSearchTerm] = useState('');
  const [filteredAOPs, setFilteredAOPs] = useState([]);
  const [aopSearchOpen, setAopSearchOpen] = useState(false);
  
  // Path finding states
  const [sourceNode, setSourceNode] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [availableNodes, setAvailableNodes] = useState([]);

  // Search AOP KG states
  // Removed: Search AOP KG (Neo4j) feature per requirements

  // Removed: Neo4j search helpers

  useEffect(() => {
    loadAOPs();
    loadKEMIETerms();
  // Removed: initial Neo4j load
  }, []); // Load initial data on mount
  const [selectedNodeChain, setSelectedNodeChain] = useState([]);

  // Use shared getApiUrl from config.js

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

  // Enhanced comprehensive pathway search using new backend endpoint
  const loadComprehensivePathwayNetwork = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    console.log('🔄 Starting comprehensive pathway search for:', searchTerm);
    setKeyEventLoading(true);
    onLoadingChange && onLoadingChange(true);
    
    try {
      const url = getApiUrl('/comprehensive_pathway_search', {
        query: searchTerm.trim(),
        cross_pathway_edges: 'true',
        max_pathways: 15
      });
      console.log('Comprehensive search API URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔍 Comprehensive search response:', {
        success: data.success,
        total_matches: data.total_matches,
        total_aops: data.total_aops,
        cross_pathway_nodes: data.cross_pathway_insights?.total_cross_pathway_nodes || 0,
        graph_nodes: data.graph_data?.nodes?.length || 0
      });
      
  if (data.success && data.graph_data) {
        const metadata = data.graph_data.metadata || {};
        const stats = metadata.stats || {};
        const crossPathwayStats = stats.cross_pathway_analysis || {};
        
        console.log('✅ Comprehensive network data found!');
        console.log('Enhanced network stats:', {
          nodes: data.graph_data.nodes?.length || 0,
          edges: data.graph_data.edges?.length || 0,
          aop_count: stats.aop_count || 0,
          direct_matches: stats.direct_matches || 0,
          cross_pathway_nodes: crossPathwayStats.total_cross_pathway_nodes || 0,
          cross_pathway_edges: crossPathwayStats.total_cross_pathway_edges || 0
        });
        
        const networkTitle = `Comprehensive AOP Network: "${searchTerm}" (${stats.aop_count || 0} AOPs, ${stats.direct_matches || 0} matches, ${crossPathwayStats.total_cross_pathway_nodes || 0} cross-pathway nodes)`;
        
        if (onAOPSelect) {
          console.log('🔄 Calling onAOPSelect with comprehensive data:', networkTitle);
          // Remove chemical and search-term artifacts for Comprehensive Pathway Search
          const stripUnwanted = (graph) => {
            // 1) Drop chemical nodes/hypernodes
            let nodes = (graph.nodes || []).filter(n => {
              if (!n) return false;
              const t = (n.type || n.original_type || '').toString().toLowerCase();
              // Also drop backend-injected SearchTerm node
              const isSearchTerm = t === 'searchterm' || n.is_search_term === true;
              return t !== 'chemical' && t !== 'chemical-hypernode' && !isSearchTerm;
            });
            const keepIds = new Set(nodes.map(n => n.id));
            // 2) Drop chemical-related edges and search edges
            let edges = (graph.edges || []).filter(e => {
              if (!e || !e.source || !e.target) return false;
              const et = (e.type || e.relationship || '').toString().toLowerCase();
              const isChemicalEdge = et === 'chemical_connection' || et === 'chemical-hyperedge' || et === 'chemical_hyperedge';
              const isSearchEdge = e.is_search_edge === true || et === 'search_connection';
              if (isChemicalEdge || isSearchEdge) return false;
              return keepIds.has(e.source) && keepIds.has(e.target);
            });
            // 3) Update metadata counts
            const newMeta = { ...(graph.metadata || {}) };
            if (newMeta.stats) {
              newMeta.stats = { ...newMeta.stats, nodes: nodes.length, edges: edges.length };
            }
            return { ...graph, nodes, edges, metadata: newMeta };
          };

          let filteredGraph = stripUnwanted(data.graph_data);
          // Tag source and layout hint so the hypergraph view can prefer force layout
          filteredGraph.metadata = {
            ...(filteredGraph.metadata || {}),
            source: 'comprehensive_search',
            layout_hint: 'force'
          };
          onAOPSelect(filteredGraph, networkTitle);
          console.log('✅ Comprehensive network loaded successfully!');
        } else {
          console.error('❌ onAOPSelect callback not available!');
        }
      } else {
        console.error('❌ Comprehensive search failed:', data.error || 'No graph data returned');
        if (data.matching_nodes_summary && data.matching_nodes_summary.length > 0) {
          console.log('📋 Found matching nodes but no network generated:', data.matching_nodes_summary.length);
        }
      }
    } catch (error) {
      console.error('❌ Comprehensive pathway search error:', error);
    } finally {
      setKeyEventLoading(false);
      onLoadingChange && onLoadingChange(false);
      console.log('🏁 Comprehensive pathway search finished');
    }
  };

  // Legacy network loading for fallback
  const loadNetworkForSearch = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    console.log('🔄 Starting legacy network load for:', searchTerm);
    setKeyEventLoading(true);
    
    try {
      const url = getApiUrl('/search_key_events', {
        query: searchTerm.trim(),
        limit: 100,
        complete_pathways: 'true'
      });
      console.log('Legacy API URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Legacy API Response:', data);
      
      if (data.success) {
        if (data.graph_data && data.graph_data !== null) {
          const metadata = data.graph_data.metadata || {};
          const stats = metadata.stats || {};
          
          const networkTitle = `AOP Pathways: "${searchTerm}" (${stats.aop_count || 0} AOPs, ${stats.direct_matches || 0} direct matches)`;
          
          if (onAOPSelect) {
            console.log('🔄 Calling onAOPSelect with legacy data:', networkTitle);
            onAOPSelect(data.graph_data, networkTitle);
          }
        }
      }
    } catch (error) {
      console.error('❌ Legacy network loading error:', error);
    } finally {
      setKeyEventLoading(false);
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

  const clearKEMIESelection = () => {
    setSelectedKEMIETerms([]);
  };

  // Load network for a single selected term
  const loadNetworkForTerm = async (term) => {
    if (!term) return;

    console.log('🔄 Loading network for term:', term.label, term.id);
    setKeyEventLoading(true);
    onLoadingChange && onLoadingChange(true);
    
    try {
      const response = await fetch(getApiUrl('/generate_ke_mie_network'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term_ids: [term.id],
          unique_nodes: true // Ensure unique nodes
        })
      });
      
      const data = await response.json();
      console.log('🔍 Full backend response:', data);
      console.log('🔍 Success:', data.success);
      console.log('🔍 Graph data:', data.graph_data);
      console.log('🔍 Graph data nodes:', data.graph_data?.nodes?.length);
      console.log('🔍 Graph data edges:', data.graph_data?.edges?.length);
      
      if (data.success && data.graph_data) {
        const networkTitle = `AOP Network: ${term.label} (${term.type === 'KeyEvent' ? 'KE' : term.type === 'MolecularInitiatingEvent' ? 'MIE' : 'AO'})`;
        
        console.log('✅ Generated network for term:', data.graph_data);
        console.log('✅ Network title:', networkTitle);
        console.log('✅ Calling onAOPSelect with:', { nodes: data.graph_data.nodes?.length || 0, edges: data.graph_data.edges?.length || 0 });
        onAOPSelect && onAOPSelect(data.graph_data, networkTitle);
      } else {
        console.error('❌ Failed to generate network for term:', data.error || 'No graph data');
        console.error('❌ Data success:', data.success);
        console.error('❌ Data has graph_data:', !!data.graph_data);
        onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
      }
    } catch (error) {
      console.error('💥 Error loading network for term:', error);
      onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
    } finally {
      setKeyEventLoading(false);
      onLoadingChange && onLoadingChange(false);
    }
  };

  const handleMultiAOPSelection = (aopObj) => {
    // Ensure we're working with the correct AOP ID format
    const aopId = aopObj.id || aopObj.name || aopObj;
    console.log('Multi-AOP selection triggered with object:', aopObj);
    console.log('Extracted AOP ID:', aopId);
    
    let newSelection;
    const currentIds = selectedAOPs.map(a => a.id || a.name || a);
    console.log('Current selected AOP IDs:', currentIds);
    
    if (currentIds.includes(aopId)) {
      // Remove from selection
      newSelection = selectedAOPs.filter(selected => {
        const selectedId = selected.id || selected.name || selected;
        return selectedId !== aopId;
      });
      console.log('Removing AOP from selection:', aopId);
    } else {
      // Add to selection
      newSelection = [...selectedAOPs, aopObj];
      console.log('Adding AOP to selection:', aopId);
    }
    
    setSelectedAOPs(newSelection);
  
    // Notify parent incrementally as selection changes
    if (typeof onAOPSelect === 'function' && onAOPSelect.__expectsIncremental) {
      const aopIds = newSelection.map(a => a.id || a.name || a);
      console.log('Sending AOP IDs to parent:', aopIds);
      onAOPSelect({ __selectionChange: true, aopIds }, aopIds.join(', '));
    } else {
      // Legacy behavior: fetch and combine immediately
      if (newSelection.length > 0) {
        const aopIds = newSelection.map(a => a.id || a.name || a);
        loadMultipleAOPGraphs(aopIds);
      } else {
        onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
      }
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

  // Clear graph when switching to comprehensive pathway search mode
  useEffect(() => {
    if (searchMode === 'keyEvent') {
      console.log('🔄 Clearing graph for Comprehensive Pathway Search mode');
      if (onAOPSelect) {
        onAOPSelect({ nodes: [], edges: [] }, '');
      }
      setSelectedKEMIETerms([]);
    }
  }, [searchMode]); // Remove onAOPSelect from dependencies to prevent infinite loop

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    addToNodeChain,
    removeFromNodeChain,
    clearNodeChain,
    getSelectedNodeChain: () => selectedNodeChain
  }));

  // Path finding functions
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
                  onChange={(e) => setSearchMode(e.target.value)}
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
                  onChange={(e) => setSearchMode(e.target.value)}
                  className="w-4 h-4"
                />
                <label htmlFor="key-event-mode" className="text-sm">Comprehensive Pathway Search - Find complete AOP networks by biological terms</label>
              </div>
            </div>
          </div>
          
          {/* Key Event Search Mode */}
          {searchMode === 'keyEvent' && (
            <div className="space-y-4" style={{backgroundColor: '#f0f8ff', padding: '15px', border: '2px solid #0066cc', borderRadius: '8px'}}>
              <div>
                <h3 className="text-sm font-medium text-gray-900 flex items-center mb-3">
                  <Search className="w-4 h-4 mr-2 text-blue-500" />
                  Comprehensive AOP Pathway Search
                </h3>
                <div className="text-xs text-muted-foreground mb-3">
                  <strong>Discover complete AOP networks through biological term queries</strong>
                  <br />
                  <span className="text-green-600">✨ Enhanced with cross-pathway relationship analysis and comprehensive node associations</span>
                </div>
              </div>
              
              {/* Enhanced Search Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Search Biological Terms</label>
                <div className="text-xs text-muted-foreground mb-2">
                  Enter any biological term (e.g., "acetylcholinesterase", "DNA damage", "oxidative stress", "liver fibrosis")
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={keyEventSearch}
                    onChange={handleKeyEventSearch}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && keyEventSearch.trim().length > 2 && !keyEventLoading) {
                        loadComprehensivePathwayNetwork(keyEventSearch);
                      }
                    }}
                    placeholder="Search for biological terms across all AOPs..."
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                  {keyEventSearch && (
                    <button
                      onClick={() => {
                        setKeyEventSearch('');
                        setKeyEventResults([]);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Actions removed per request – press Enter to load the network; preview updates automatically */}
              </div>
              
              
              {/* Search Results Preview */}
              {keyEventResults.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Search Preview ({keyEventResults.length} matches)</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {keyEventResults.slice(0, 10).map((result, index) => (
                      <div
                        key={index}
                        className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-blue-50 cursor-pointer"
                        onClick={() => {
                          setKeyEventSearch(result.label);
                          loadComprehensivePathwayNetwork(result.label);
                        }}
                      >
                        <div className="font-medium">{result.label}</div>
                        <div className="text-gray-500">{result.type} • {result.aop_title}</div>
                      </div>
                    ))}
                  </div>
                  {keyEventResults.length > 10 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Showing first 10 of {keyEventResults.length} matches
                    </div>
                  )}
                </div>
              )}
              
              {/* No Results Message */}
              {keyEventResults.length === 0 && !keyEventLoading && keyEventSearch.length > 0 && (
                <div className="mt-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <div className="text-xs text-orange-800">
                      <div className="font-medium mb-1">🔍 No results found for "{keyEventSearch}"</div>
                      <div>Try different terms or check spelling. The search looks across all {availableKEMIETerms.length} MIE, KE, and AO terms in the database.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Removed: Search AOP KG Mode */}
          
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
                        if (typeof onAOPSelect === 'function' && onAOPSelect.__expectsIncremental) {
                          onAOPSelect({ __selectionChange: true, aopIds: [] }, '');
                        } else {
                          onAOPSelect && onAOPSelect({ nodes: [], edges: [] }, '');
                        }
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
          
          {/* Path Finding Mode removed per simplification */}
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
              {/* Max Nodes Per Hypernode Slider */}
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


