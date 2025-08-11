import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Route, Network, X, ArrowUpDown } from 'lucide-react';

const UnifiedControlPanel = forwardRef(({ 
  onAOPSelect, 
  onPathFind, 
  selectedAOP, 
  pathResults,
  isLoading,
  onPathResults // New prop for setting path results directly
}, ref) => {
  const [mode, setMode] = useState('aop');
  const [aops, setAOPs] = useState([]);
  const [allNodes, setAllNodes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAOPs, setFilteredAOPs] = useState([]);
  
  // Multi-select AOP state
  const [selectedAOPs, setSelectedAOPs] = useState([]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  
  // Key Event search state
  const [keyEvents, setKeyEvents] = useState([]);
  const [selectedKeyEvents, setSelectedKeyEvents] = useState([]);
  const [keyEventSearchTerm, setKeyEventSearchTerm] = useState('');
  const [filteredKeyEvents, setFilteredKeyEvents] = useState([]);
  const [isKeyEventSearching, setIsKeyEventSearching] = useState(false);
  
  // Path finding state
  const [sourceNode, setSourceNode] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [pathType, setPathType] = useState('shortest');
  const [kValue, setKValue] = useState(3);
  const [bidirectional, setBidirectional] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [filteredSourceNodes, setFilteredSourceNodes] = useState([]);
  const [filteredTargetNodes, setFilteredTargetNodes] = useState([]);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  useEffect(() => {
    fetchAOPs();
    fetchAllNodes();
    fetchKeyEvents();
  }, []);

  useEffect(() => {
    const filtered = aops.filter(aop => 
      aop.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAOPs(filtered.slice(0, 100)); // Limit to 100 for performance
  }, [searchTerm, aops]);

  useEffect(() => {
    const filtered = keyEvents.filter(ke => 
      (ke.name && ke.name.toLowerCase().includes(keyEventSearchTerm.toLowerCase())) ||
      (ke.id && ke.id.toLowerCase().includes(keyEventSearchTerm.toLowerCase())) ||
      (ke.description && ke.description.toLowerCase().includes(keyEventSearchTerm.toLowerCase())) ||
      (ke.type && ke.type.toLowerCase().includes(keyEventSearchTerm.toLowerCase()))
    );
    setFilteredKeyEvents(filtered.slice(0, 100));
  }, [keyEventSearchTerm, keyEvents]);

  useEffect(() => {
    const filtered = allNodes.filter(node => 
      node.label.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      node.id.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      (node.ontology_term && node.ontology_term.toLowerCase().includes(sourceSearch.toLowerCase())) ||
      (node.type && node.type.toLowerCase().includes(sourceSearch.toLowerCase()))
    );
    setFilteredSourceNodes(filtered.slice(0, 100));
  }, [sourceSearch, allNodes]);

  useEffect(() => {
    const filtered = allNodes.filter(node => 
      node.label.toLowerCase().includes(targetSearch.toLowerCase()) ||
      node.id.toLowerCase().includes(targetSearch.toLowerCase()) ||
      (node.ontology_term && node.ontology_term.toLowerCase().includes(targetSearch.toLowerCase())) ||
      (node.type && node.type.toLowerCase().includes(targetSearch.toLowerCase()))
    );
    setFilteredTargetNodes(filtered.slice(0, 100));
  }, [targetSearch, allNodes]);

  const fetchAOPs = async () => {
    try {
      const response = await fetch('http://localhost:5001/aops');
      const data = await response.json();
      setAOPs(data);
      setFilteredAOPs(data.slice(0, 100));
    } catch (error) {
      console.error('Error fetching AOPs:', error);
    }
  };

  const fetchAllNodes = async () => {
    try {
      const response = await fetch('http://localhost:5001/all_nodes');
      const data = await response.json();
      setAllNodes(data.nodes || []);
      setFilteredSourceNodes(data.nodes?.slice(0, 100) || []);
      setFilteredTargetNodes(data.nodes?.slice(0, 100) || []);
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const fetchKeyEvents = async () => {
    try {
      console.log('🔍 Fetching key events from backend...');
      const response = await fetch('http://localhost:5001/key_events');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Key events response:', {
        status: response.status,
        keyEventsCount: data.key_events?.length || 0,
        totalAvailable: data.total_available,
        firstFew: data.key_events?.slice(0, 3)
      });
      
      setKeyEvents(data.key_events || []);
      setFilteredKeyEvents(data.key_events?.slice(0, 100) || []);
      
      if (!data.key_events || data.key_events.length === 0) {
        console.warn('⚠️ No key events returned from backend');
      }
    } catch (error) {
      console.error('❌ Error fetching key events:', error);
      // Set empty arrays to prevent undefined errors
      setKeyEvents([]);
      setFilteredKeyEvents([]);
    }
  };

  // Enhanced directional path finding for MIE → KE → AO through selected node
  const findPathsThroughNode = async (selectedNode) => {
    try {
      const currentAOP = selectedAOP;
      if (!currentAOP) {
        console.log('Please select an AOP first');
        return;
      }

      console.log(`Finding directional paths (MIE → KE → AO) through node: ${selectedNode.label} (${selectedNode.type})`);

      // Get all nodes with their types
      const mieNodes = allNodes.filter(node => node.type === 'MolecularInitiatingEvent');
      const keNodes = allNodes.filter(node => node.type === 'KeyEvent');
      const aoNodes = allNodes.filter(node => node.type === 'AdverseOutcome');
      
      console.log(`Found ${mieNodes.length} MIE nodes, ${keNodes.length} KE nodes, and ${aoNodes.length} AO nodes`);

      const allPaths = [];
      
      // Determine the role of the selected node in the pathway
      const selectedNodeType = selectedNode.type;
      
      if (selectedNodeType === 'MolecularInitiatingEvent') {
        // Selected node is MIE - find paths MIE → KE → AO
        console.log('Selected node is MIE - finding paths to AO through Key Events');
        
        for (const aoNode of aoNodes) {
          try {
            // Find paths from selected MIE to AO (will naturally go through KE nodes)
            const pathsUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(selectedNode.id)}&target=${encodeURIComponent(aoNode.id)}&k=10&aop=${encodeURIComponent(currentAOP)}`;
            const pathsResponse = await fetch(pathsUrl);
            const pathsData = await pathsResponse.json();

            if (pathsData.paths) {
              pathsData.paths.forEach((path, i) => {
                // Validate that path contains at least one KE node
                const hasKE = path.some(nodeId => {
                  const node = allNodes.find(n => n.id === nodeId);
                  return node && node.type === 'KeyEvent';
                });
                
                if (hasKE && path.length > 2) { // Ensure it's not a direct connection
                  // Convert node IDs to full node objects
                  const pathNodes = path.map(nodeId => {
                    const node = allNodes.find(n => n.id === nodeId);
                    return node || { id: nodeId, label: nodeId, type: 'Unknown' };
                  });
                  
                  allPaths.push({
                    path: path, // Keep original node IDs for backend compatibility
                    nodes: pathNodes, // Add full node objects for display
                    length: path.length,
                    source: selectedNode.id,
                    target: aoNode.id,
                    weight: path.length,
                    mie_label: selectedNode.label,
                    ao_label: aoNode.label,
                    via_node: selectedNode.label,
                    pathway_type: 'MIE→KE→AO',
                    path_index: i + 1
                  });
                }
              });
            }
          } catch (error) {
            console.error(`Error finding path from MIE ${selectedNode.id} to AO ${aoNode.id}:`, error);
          }
        }
        
      } else if (selectedNodeType === 'KeyEvent') {
        // Selected node is KE - find paths MIE → selected KE → AO
        console.log('Selected node is KE - finding paths from MIE through this KE to AO');
        
        for (const mieNode of mieNodes) {
          for (const aoNode of aoNodes) {
            try {
              // Find paths from MIE to selected KE
              const pathsToKEUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(mieNode.id)}&target=${encodeURIComponent(selectedNode.id)}&k=5&aop=${encodeURIComponent(currentAOP)}`;
              const pathsToKEResponse = await fetch(pathsToKEUrl);
              const pathsToKEData = await pathsToKEResponse.json();

              // Find paths from selected KE to AO
              const pathsFromKEUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(selectedNode.id)}&target=${encodeURIComponent(aoNode.id)}&k=5&aop=${encodeURIComponent(currentAOP)}`;
              const pathsFromKEResponse = await fetch(pathsFromKEUrl);
              const pathsFromKEData = await pathsFromKEResponse.json();

              // Combine paths if both parts exist
              if (pathsToKEData.paths && pathsFromKEData.paths) {
                pathsToKEData.paths.forEach((pathToKE, i) => {
                  pathsFromKEData.paths.forEach((pathFromKE, j) => {
                    // Remove the duplicate selected node at the junction
                    const combinedPath = [
                      ...pathToKE.slice(0, -1), // All nodes except the last (selected KE)
                      ...pathFromKE // All nodes including the selected KE and onwards
                    ];
                    
                    // Ensure this is a valid MIE→KE→AO path
                    if (combinedPath.length >= 3) {
                      // Convert node IDs to full node objects
                      const pathNodes = combinedPath.map(nodeId => {
                        const node = allNodes.find(n => n.id === nodeId);
                        return node || { id: nodeId, label: nodeId, type: 'Unknown' };
                      });
                      
                      allPaths.push({
                        path: combinedPath, // Keep original node IDs for backend compatibility
                        nodes: pathNodes, // Add full node objects for display
                        length: combinedPath.length,
                        source: mieNode.id,
                        target: aoNode.id,
                        weight: combinedPath.length,
                        mie_label: mieNode.label,
                        ao_label: aoNode.label,
                        via_node: selectedNode.label,
                        pathway_type: `MIE→${selectedNode.label}→AO`,
                        path_index: `${i + 1}.${j + 1}`
                      });
                    }
                  });
                });
              }
            } catch (error) {
              console.error(`Error finding path from MIE ${mieNode.id} through KE ${selectedNode.id} to AO ${aoNode.id}:`, error);
            }
          }
        }
        
      } else if (selectedNodeType === 'AdverseOutcome') {
        // Selected node is AO - find paths MIE → KE → selected AO
        console.log('Selected node is AO - finding paths from MIE through Key Events to this AO');
        
        for (const mieNode of mieNodes) {
          try {
            // Find paths from MIE to selected AO (will naturally go through KE nodes)
            const pathsUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(mieNode.id)}&target=${encodeURIComponent(selectedNode.id)}&k=10&aop=${encodeURIComponent(currentAOP)}`;
            const pathsResponse = await fetch(pathsUrl);
            const pathsData = await pathsResponse.json();

            if (pathsData.paths) {
              pathsData.paths.forEach((path, i) => {
                // Validate that path contains at least one KE node
                const hasKE = path.some(nodeId => {
                  const node = allNodes.find(n => n.id === nodeId);
                  return node && node.type === 'KeyEvent';
                });
                
                if (hasKE && path.length > 2) { // Ensure it's not a direct connection
                  // Convert node IDs to full node objects
                  const pathNodes = path.map(nodeId => {
                    const node = allNodes.find(n => n.id === nodeId);
                    return node || { id: nodeId, label: nodeId, type: 'Unknown' };
                  });
                  
                  allPaths.push({
                    path: path, // Keep original node IDs for backend compatibility
                    nodes: pathNodes, // Add full node objects for display
                    length: path.length,
                    source: mieNode.id,
                    target: selectedNode.id,
                    weight: path.length,
                    mie_label: mieNode.label,
                    ao_label: selectedNode.label,
                    via_node: selectedNode.label,
                    pathway_type: 'MIE→KE→AO',
                    path_index: i + 1
                  });
                }
              });
            }
          } catch (error) {
            console.error(`Error finding path from MIE ${mieNode.id} to AO ${selectedNode.id}:`, error);
          }
        }
      } else {
        // Unknown node type - treat as potential intermediate node
        console.log('Selected node type unknown - treating as intermediate node');
        
        for (const mieNode of mieNodes) {
          for (const aoNode of aoNodes) {
            try {
              // Find paths from MIE to selected node
              const pathsToNodeUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(mieNode.id)}&target=${encodeURIComponent(selectedNode.id)}&k=3&aop=${encodeURIComponent(currentAOP)}`;
              const pathsToNodeResponse = await fetch(pathsToNodeUrl);
              const pathsToNodeData = await pathsToNodeResponse.json();

              // Find paths from selected node to AO
              const pathsFromNodeUrl = `http://localhost:5001/k_shortest_paths?source=${encodeURIComponent(selectedNode.id)}&target=${encodeURIComponent(aoNode.id)}&k=3&aop=${encodeURIComponent(currentAOP)}`;
              const pathsFromNodeResponse = await fetch(pathsFromNodeUrl);
              const pathsFromNodeData = await pathsFromNodeResponse.json();

              // Combine paths if both parts exist
              if (pathsToNodeData.paths && pathsFromNodeData.paths) {
                pathsToNodeData.paths.forEach((pathToNode, i) => {
                  pathsFromNodeData.paths.forEach((pathFromNode, j) => {
                    const combinedPath = [
                      ...pathToNode.slice(0, -1),
                      ...pathFromNode
                    ];
                    
                    if (combinedPath.length >= 3) {
                      // Convert node IDs to full node objects
                      const pathNodes = combinedPath.map(nodeId => {
                        const node = allNodes.find(n => n.id === nodeId);
                        return node || { id: nodeId, label: nodeId, type: 'Unknown' };
                      });
                      
                      allPaths.push({
                        path: combinedPath, // Keep original node IDs for backend compatibility
                        nodes: pathNodes, // Add full node objects for display
                        length: combinedPath.length,
                        source: mieNode.id,
                        target: aoNode.id,
                        weight: combinedPath.length,
                        mie_label: mieNode.label,
                        ao_label: aoNode.label,
                        via_node: selectedNode.label,
                        pathway_type: `MIE→${selectedNode.label}→AO`,
                        path_index: `${i + 1}.${j + 1}`
                      });
                    }
                  });
                });
              }
            } catch (error) {
              console.error(`Error finding path from ${mieNode.id} to ${aoNode.id} through ${selectedNode.id}:`, error);
            }
          }
        }
      }

      // Sort paths by length (shorter paths first), then by pathway type
      allPaths.sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return a.pathway_type.localeCompare(b.pathway_type);
      });

      console.log(`Found ${allPaths.length} directional paths through ${selectedNode.label}`);
      
      // Add detailed path analysis
      const pathAnalysis = {
        total_paths: allPaths.length,
        node_type: selectedNodeType,
        shortest_path_length: allPaths.length > 0 ? allPaths[0].weight : 0,
        longest_path_length: allPaths.length > 0 ? allPaths[allPaths.length - 1].weight : 0,
        unique_mie_nodes: new Set(allPaths.map(p => p.source)).size,
        unique_ao_nodes: new Set(allPaths.map(p => p.target)).size
      };
      
      // Format the results for the existing PathVisualizationPanel
      const formattedResults = {
        type: 'directional_paths_through_node',
        count: allPaths.length,
        paths: allPaths,
        source: selectedNodeType === 'MolecularInitiatingEvent' ? selectedNode.label : 'Multiple MIE nodes',
        target: selectedNodeType === 'AdverseOutcome' ? selectedNode.label : 'Multiple AO nodes',
        via_node: selectedNode.label,
        via_node_type: selectedNodeType,
        nodes: allNodes,
        k: allPaths.length,
        analysis: pathAnalysis,
        directionality_info: 'Paths respect MIE → KE → AO directionality'
      };

      // Use the callback to update the right panel
      if (onPathResults) {
        onPathResults(formattedResults);
        console.log('Directional path results sent to right panel:', formattedResults);
      }
      
    } catch (error) {
      console.error('Error finding directional paths through node:', error);
    }
  };

  // Expose addToNodeChain method for NetworkGraph to call
  useImperativeHandle(ref, () => ({
    addToNodeChain: (nodeId) => {
      const selectedNode = allNodes.find(node => node.id === nodeId);
      if (selectedNode) {
        console.log(`Node clicked: ${selectedNode.label} (${selectedNode.type})`);
        findPathsThroughNode(selectedNode);
      }
    }
  }));

  const handleAOPSelect = (aop) => {
    if (isMultiSelect) {
      if (selectedAOPs.includes(aop)) {
        const newSelected = selectedAOPs.filter(a => a !== aop);
        setSelectedAOPs(newSelected);
        if (newSelected.length > 0) {
          handleMultiAOPLoad(newSelected);
        }
      } else {
        const newSelected = [...selectedAOPs, aop];
        setSelectedAOPs(newSelected);
        handleMultiAOPLoad(newSelected);
      }
    } else {
      onAOPSelect(aop);
    }
  };

  const handleMultiAOPLoad = async (aopList) => {
    try {
      // Fetch data for all selected AOPs and combine
      const promises = aopList.map(aop => 
        fetch(`http://localhost:5001/aop_graph?aop=${aop}`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      
      // Combine all nodes and edges
      const combinedNodes = new Map();
      const combinedEdges = [];
      
      results.forEach(result => {
        result.nodes?.forEach(node => {
          combinedNodes.set(node.id, node);
        });
        combinedEdges.push(...(result.edges || []));
      });
      
      const combinedData = {
        nodes: Array.from(combinedNodes.values()),
        edges: combinedEdges
      };
      
      onAOPSelect(combinedData, `${aopList.length} AOPs selected`);
    } catch (error) {
      console.error('Error loading multi-AOP data:', error);
    }
  };

  const clearSelectedAOPs = () => {
    setSelectedAOPs([]);
    onAOPSelect({ nodes: [], edges: [] }, '');
  };

  const handlePathFind = () => {
    console.log('Path find request:', { sourceNode, targetNode, pathType });
    
    if (!sourceNode || !targetNode || sourceNode.trim() === '' || targetNode.trim() === '') {
      alert('Please select both source and target nodes');
      return;
    }

    const params = {
      source: sourceNode,
      target: targetNode,
      type: pathType,
      bidirectional: bidirectional
    };

    if (pathType === 'k_shortest') {
      params.k = kValue;
    }

    console.log('Sending path find params:', params);
    onPathFind(params);
  };

  const swapSourceTarget = () => {
    // Swap source and target
    const tempNode = sourceNode;
    const tempSearch = sourceSearch;
    
    setSourceNode(targetNode);
    setSourceSearch(targetSearch);
    setTargetNode(tempNode);
    setTargetSearch(tempSearch);
  };

  const getNodeDisplayText = (node) => {
    return `${node.label} (${node.type})`;
  };

  const getSelectedSourceNode = () => {
    return allNodes.find(node => node.id === sourceNode);
  };

  const getSelectedTargetNode = () => {
    return allNodes.find(node => node.id === targetNode);
  };

  // Key Event handlers
  const handleKeyEventToggle = (keyEventId) => {
    setSelectedKeyEvents(prev => {
      if (prev.includes(keyEventId)) {
        return prev.filter(id => id !== keyEventId);
      } else {
        return [...prev, keyEventId];
      }
    });
  };

  const handleKeyEventSearch = async () => {
    if (selectedKeyEvents.length === 0) {
      alert('Please select at least one Key Event');
      return;
    }
    
    console.log('🔍 Key Event search request:', { selectedKeyEvents });
    setIsKeyEventSearching(true);
    
    try {
      // Show loading state (you can add a loading spinner here)
      const response = await fetch('http://localhost:5001/key_event_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyEvents: selectedKeyEvents
        })
      });
      
      console.log('📡 Key Event search response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Key Event search result:', {
        success: true,
        nodesCount: result.nodes?.length || 0,
        edgesCount: result.edges?.length || 0,
        affectedAOPs: result.affected_aops,
        keyEvents: result.key_events,
        sharedEvents: result.shared_events,
        rawResult: result
      });
      
      // Validate the response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response: not a valid JSON object');
      }
      
      // Call onAOPSelect with the Key Event results (similar to AOP visualization)
      const keyEventData = {
        nodes: Array.isArray(result.nodes) ? result.nodes : [],
        edges: Array.isArray(result.edges) ? result.edges : []
      };
      
      console.log('🔍 Processed Key Event data:', {
        nodesCount: keyEventData.nodes.length,
        edgesCount: keyEventData.edges.length,
        firstNode: keyEventData.nodes[0],
        firstEdge: keyEventData.edges[0]
      });
      
      if (keyEventData.nodes.length === 0) {
        console.warn('⚠️ No nodes found in Key Event search result');
        alert(`No pathway nodes found for the selected Key Events: ${selectedKeyEvents.join(', ')}. 
        
This might indicate:
• The events are not connected to other pathway components
• Missing data in the TSV files
• Server processing error

Please check the backend server logs for more details.`);
        return;
      }
      
      const description = `Key Events: ${selectedKeyEvents.join(', ')} (${keyEventData.nodes.length} nodes, ${keyEventData.edges.length} edges)`;
      console.log('🎯 Calling onAOPSelect with:', { 
        keyEventData, 
        description,
        type: 'key_event_search'
      });
      
      // Call the parent component's handler
      if (typeof onAOPSelect === 'function') {
        onAOPSelect(keyEventData, description);
        console.log('✅ onAOPSelect called successfully');
      } else {
        console.error('❌ onAOPSelect is not a function:', typeof onAOPSelect);
        throw new Error('onAOPSelect handler is not available');
      }
      
    } catch (error) {
      console.error('❌ Key Event search failed:', {
        error: error.message,
        stack: error.stack,
        selectedKeyEvents
      });
      
      // Show detailed error to user
      alert(`Key Event search failed: ${error.message}
      
Selected Events: ${selectedKeyEvents.join(', ')}

Troubleshooting:
• Check that the backend server is running on http://localhost:5001
• Verify the server logs for errors
• Try selecting different key events
• Refresh the page and try again`);
    } finally {
      setIsKeyEventSearching(false);
    }
  };

  const clearKeyEventSelection = () => {
    setSelectedKeyEvents([]);
  };

  return (
    <Card className="w-80 h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          AOP Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Analysis Mode</Label>
          <RadioGroup value={mode} onValueChange={setMode} className="grid grid-cols-1 gap-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="aop" id="aop" />
              <Label htmlFor="aop" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                AOP Explorer
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pathfinding" id="pathfinding" />
              <Label htmlFor="pathfinding" className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Path Finding
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="keyEvent" id="keyEvent" />
              <Label htmlFor="keyEvent" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Key Event Search
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* AOP Selection Mode */}
        {mode === 'aop' && (
          <div className="space-y-4">
            {/* Multi-select toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="multiselect"
                checked={isMultiSelect}
                onChange={(e) => {
                  setIsMultiSelect(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedAOPs([]);
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="multiselect" className="text-sm">Multi-select AOPs</Label>
            </div>

            {/* Selected AOPs counter */}
            {isMultiSelect && selectedAOPs.length > 0 && (
              <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded">
                <span className="text-sm text-blue-700">
                  Selected: {selectedAOPs.length} AOP(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelectedAOPs}
                  className="h-6 px-2 text-xs"
                >
                  Clear All
                </Button>
              </div>
            )}
            
            <div>
              <Label className="text-sm font-medium">Search AOPs</Label>
              <Input
                type="text"
                placeholder="Type to search AOPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full mt-1"
              />
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <Label className="text-sm font-medium">
                Available AOPs ({filteredAOPs.length})
              </Label>
              <div className="space-y-1">
                {filteredAOPs.map((aop) => (
                  <button
                    key={aop}
                    onClick={() => handleAOPSelect(aop)}
                    className={`w-full text-left p-2 rounded text-sm border transition-colors ${
                      isMultiSelect
                        ? selectedAOPs.includes(aop)
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        : selectedAOP === aop
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {aop}
                  </button>
                ))}
              </div>
            </div>

            {!isMultiSelect && selectedAOP && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Selected:</span> {selectedAOP}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Path Finding Mode */}
        {mode === 'pathfinding' && (
          <div className="space-y-4">
            {/* Source Node */}
            <div>
              <Label className="text-sm font-medium">Source Node</Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search source node (e.g., 'MIE Alkylation, Protein')..."
                  value={sourceSearch}
                  onChange={(e) => {
                    setSourceSearch(e.target.value);
                    setShowSourceDropdown(true);
                  }}
                  onFocus={() => setShowSourceDropdown(true)}
                  className="w-full mt-1"
                />
                {getSelectedSourceNode() && (
                  <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <span className="font-medium">Selected:</span> {getNodeDisplayText(getSelectedSourceNode())}
                  </div>
                )}
                {showSourceDropdown && filteredSourceNodes.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
                    {filteredSourceNodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSourceNode(node.id);
                          setSourceSearch(node.label);
                          setShowSourceDropdown(false);
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 border-b border-gray-100 text-sm"
                      >
                        <div className="font-medium">{node.label}</div>
                        <div className="text-xs text-gray-500">
                          {node.type} | {node.aop} {node.ontology_term && `| ${node.ontology_term}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={swapSourceTarget}
                className="p-2"
                title="Swap source and target"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Target Node */}
            <div>
              <Label className="text-sm font-medium">Target Node</Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search target node (e.g., 'AO liver fibrosis')..."
                  value={targetSearch}
                  onChange={(e) => {
                    setTargetSearch(e.target.value);
                    setShowTargetDropdown(true);
                  }}
                  onFocus={() => setShowTargetDropdown(true)}
                  className="w-full mt-1"
                />
                {getSelectedTargetNode() && (
                  <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <span className="font-medium">Selected:</span> {getNodeDisplayText(getSelectedTargetNode())}
                  </div>
                )}
                {showTargetDropdown && filteredTargetNodes.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
                    {filteredTargetNodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setTargetNode(node.id);
                          setTargetSearch(node.label);
                          setShowTargetDropdown(false);
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 border-b border-gray-100 text-sm"
                      >
                        <div className="font-medium">{node.label}</div>
                        <div className="text-xs text-gray-500">
                          {node.type} | {node.aop} {node.ontology_term && `| ${node.ontology_term}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bidirectional Search Option */}
            <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <input
                type="checkbox"
                id="bidirectional"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="bidirectional" className="text-sm">
                Allow reverse paths (AO → MIE)
              </Label>
            </div>

            <div>
              <Label className="text-sm font-medium">Path Type</Label>
              <Select value={pathType} onValueChange={setPathType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shortest">Shortest Path</SelectItem>
                  <SelectItem value="k_shortest">Top-K Paths</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pathType === 'k_shortest' && (
              <div>
                <Label className="text-sm font-medium">Number of Paths (K)</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={kValue}
                  onChange={(e) => setKValue(parseInt(e.target.value) || 3)}
                  className="w-full"
                />
              </div>
            )}

            <Button 
              onClick={handlePathFind} 
              disabled={!sourceNode || !targetNode || isLoading}
              className="w-full"
            >
              {isLoading ? 'Finding Paths...' : `Find ${pathType === 'shortest' ? 'Shortest Path' : `Top-${kValue} Paths`}${bidirectional ? ' (Bidirectional)' : ''}`}
            </Button>

            {pathResults && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-700 font-medium">
                  Path Results:
                </p>
                {pathResults.type === 'shortest_path' && pathResults.path && (
                  <p className="text-sm text-blue-600">
                    Found path with {pathResults.length} steps
                  </p>
                )}
                {pathResults.type === 'k_shortest_paths' && (
                  <p className="text-sm text-blue-600">
                    Found {pathResults.count} paths (K={pathResults.k})
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Key Event Search Mode */}
        {mode === 'keyEvent' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Key Events
              </label>
              <input
                type="text"
                placeholder="Search key events..."
                value={keyEventSearchTerm}
                onChange={(e) => setKeyEventSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Key Events ({selectedKeyEvents.length} selected)
                </label>
                {selectedKeyEvents.length > 0 && (
                  <button
                    onClick={clearKeyEventSelection}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md">
                {filteredKeyEvents.map((keyEvent) => (
                  <label
                    key={keyEvent.id}
                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeyEvents.includes(keyEvent.id)}
                      onChange={() => handleKeyEventToggle(keyEvent.id)}
                      className="mr-3 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {keyEvent.name}
                      </div>
                      {keyEvent.description && (
                        <div className="text-xs text-gray-500">
                          {keyEvent.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                {filteredKeyEvents.length === 0 && keyEvents.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    <div>Loading key events...</div>
                    <div className="text-xs mt-1">Make sure the backend server is running on port 5001</div>
                  </div>
                )}
                {filteredKeyEvents.length === 0 && keyEvents.length > 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No key events match your search
                  </div>
                )}
                {keyEvents.length > 0 && keyEventSearchTerm && filteredKeyEvents.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No matches for "{keyEventSearchTerm}"
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleKeyEventSearch}
              disabled={selectedKeyEvents.length === 0 || isKeyEventSearching}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isKeyEventSearching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Searching...
                </span>
              ) : (
                `Search Key Events (${selectedKeyEvents.length} selected)`
              )}
            </button>

            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              <p className="text-xs text-blue-700">
                💡 <strong>Tip:</strong> Click on any node in the network to discover all MIE→AO paths through that node. Results will appear in the Paths tab on the right panel.
              </p>
            </div>
          </div>
        )}

        {/* Click outside to close dropdowns */}
        {(showSourceDropdown || showTargetDropdown) && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setShowSourceDropdown(false);
              setShowTargetDropdown(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
});

UnifiedControlPanel.displayName = 'UnifiedControlPanel';

export default UnifiedControlPanel;
