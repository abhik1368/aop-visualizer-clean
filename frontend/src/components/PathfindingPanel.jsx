import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { AlertCircle, Route, Search, Eye, BarChart3, Database, Filter } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { API_BASE_URL } from '../config';

const PathfindingPanel = ({ 
  selectedAOP, 
  onPathVisualize,
  onHypergraphVisualize,
  className = "" 
}) => {
  const [pathfindingMode, setPathfindingMode] = useState('custom'); // Default to custom for source/target search
  const [topK, setTopK] = useState(3);
  const [useHypergraph, setUseHypergraph] = useState(true);
  const [maxPerHypernode, setMaxPerHypernode] = useState(4);
  const [useFullDatabase, setUseFullDatabase] = useState(true); // Default to full database
  
  // Custom pathfinding state
  const [sourceNode, setSourceNode] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  
  // Results state - separate for shortest and longest paths
  const [shortestPaths, setShortestPaths] = useState(null);
  const [longestPaths, setLongestPaths] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Available nodes for custom pathfinding
  const [availableNodes, setAvailableNodes] = useState([]);
  const [nodesByType, setNodesByType] = useState({});
  const [databaseStats, setDatabaseStats] = useState(null);

  useEffect(() => {
    // Always load full database nodes for comprehensive search
    fetchFullDatabaseNodes();
  }, []);

  const fetchFullDatabaseNodes = async () => {
    try {
      setIsLoading(true);
      const url = `${API_BASE_URL}/full_database_nodes`;
      const response = await fetch(url);
      const data = await response.json();
      
      setAvailableNodes(data.nodes || []);
      setNodesByType(data.nodes_by_type || {});
      setDatabaseStats({
        total_nodes: data.total_nodes,
        node_type_counts: data.node_type_counts
      });
    } catch (error) {
      console.error('Error fetching full database nodes:', error);
      setError('Failed to load database nodes');
    } finally {
      setIsLoading(false);
    }
  };

  const findBothPathTypes = async (endpoint, params) => {
    setIsLoading(true);
    setError(null);
    setShortestPaths(null);
    setLongestPaths(null);
    
    try {
      // Search for shortest paths
      const shortestParams = new URLSearchParams({
        ...params,
        type: 'shortest'
      });
      const shortestUrl = `${API_BASE_URL}/${endpoint}?${shortestParams}`;
      const shortestResponse = await fetch(shortestUrl);
      const shortestData = await shortestResponse.json();
      
      // Search for longest paths
      const longestParams = new URLSearchParams({
        ...params,
        type: 'longest'
      });
      const longestUrl = `${API_BASE_URL}/${endpoint}?${longestParams}`;
      const longestResponse = await fetch(longestUrl);
      const longestData = await longestResponse.json();
      
      // Handle results
      if (shortestData.error && longestData.error) {
        setError(`No paths found: ${shortestData.error}`);
        return;
      }
      
      if (!shortestData.error && shortestData.paths && shortestData.paths.length > 0) {
        setShortestPaths(shortestData);
        if (useHypergraph && shortestData.hypergraph_data) {
          onHypergraphVisualize(shortestData.hypergraph_data);
        } else if (shortestData.graph_data) {
          onPathVisualize(shortestData.graph_data, shortestData.paths);
        }
      }
      
      if (!longestData.error && longestData.paths && longestData.paths.length > 0) {
        setLongestPaths(longestData);
      }
      
      // If no paths found in either search
      if ((!shortestData.paths || shortestData.paths.length === 0) && 
          (!longestData.paths || longestData.paths.length === 0)) {
        setError('No paths found between the selected nodes');
      }
      
    } catch (error) {
      console.error('Error finding paths:', error);
      setError('Failed to find paths. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const findMieToAoPaths = async () => {
    const params = {
      k: topK.toString(),
      hypergraph: useHypergraph.toString(),
      max_per_hypernode: maxPerHypernode.toString(),
      full_database: useFullDatabase.toString()
    };

    // Only add AOP if not using full database
    if (!useFullDatabase && selectedAOP) {
      params.aop = selectedAOP;
    }

    await findBothPathTypes('mie_to_ao_paths', params);
  };

  const findCustomPaths = async () => {
    if (!sourceNode || !targetNode) {
      setError('Please select both source and target nodes');
      return;
    }

    const params = {
      source: sourceNode,
      target: targetNode,
      k: topK.toString(),
      hypergraph: useHypergraph.toString(),
      max_per_hypernode: maxPerHypernode.toString(),
      full_database: useFullDatabase.toString()
    };

    // Only add AOP if not using full database
    if (!useFullDatabase && selectedAOP) {
      params.aop = selectedAOP;
    }

    await findBothPathTypes('custom_path_search', params);
  };

  const handleFindPaths = () => {
    if (pathfindingMode === 'mie_to_ao') {
      findMieToAoPaths();
    } else {
      findCustomPaths();
    }
  };

  const clearResults = () => {
    setShortestPaths(null);
    setLongestPaths(null);
    setError(null);
  };

  // Filter nodes based on search
  const getFilteredNodes = (searchTerm, excludeSelected = null) => {
    if (!searchTerm) return availableNodes.slice(0, 100); // Limit for performance
    
    return availableNodes
      .filter(node => 
        (node.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         node.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         node.type?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        node.id !== excludeSelected
      )
      .slice(0, 50); // Limit results
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Path Finding - Analyze Connections
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Find both shortest AND longest paths between nodes
        </div>
        {databaseStats && (
          <div className="text-sm text-muted-foreground">
            <Database className="h-4 w-4 inline mr-1" />
            {databaseStats.total_nodes.toLocaleString()} total nodes across all AOPs
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Scope Selection */}
        <div className="space-y-2">
          <Label>Search Scope</Label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={useFullDatabase}
                onChange={() => setUseFullDatabase(true)}
              />
              <span>Full AOP Database</span>
              <Badge variant="outline">Recommended</Badge>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={!useFullDatabase}
                onChange={() => setUseFullDatabase(false)}
              />
              <span>Single AOP</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* Pathfinding Mode Selection */}
        <div className="space-y-2">
          <Label>Analysis Type</Label>
          <select 
            value={pathfindingMode} 
            onChange={(e) => setPathfindingMode(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="custom">Source → Target Analysis</option>
            <option value="mie_to_ao">MIE to AO Pathways (Automatic)</option>
          </select>
          <div className="text-xs text-muted-foreground">
            Analyzes both shortest and longest paths between nodes
          </div>
        </div>

        {/* Source/Target Selection - Always visible for custom mode */}
        {pathfindingMode === 'custom' && (
          <div className="space-y-4">
            <Separator />
            
            {/* Source Node Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Source Node
              </Label>
              <Input
                type="text"
                placeholder="Search for source node..."
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                className="mb-2"
              />
              <select 
                value={sourceNode} 
                onChange={(e) => setSourceNode(e.target.value)}
                className="w-full p-2 border rounded max-h-32 overflow-y-auto"
                size="1"
              >
                <option value="">Select source node...</option>
                {getFilteredNodes(sourceSearch, targetNode).map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label || node.id} ({node.type})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Target Node Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Target Node
              </Label>
              <Input
                type="text"
                placeholder="Search for target node..."
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                className="mb-2"
              />
              <select 
                value={targetNode} 
                onChange={(e) => setTargetNode(e.target.value)}
                className="w-full p-2 border rounded max-h-32 overflow-y-auto"
                size="1"
              >
                <option value="">Select target node...</option>
                {getFilteredNodes(targetSearch, sourceNode).map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label || node.id} ({node.type})
                  </option>
                ))}
              </select>
            </div>
            
            {sourceNode && targetNode && (
              <div className="p-2 bg-muted rounded text-sm">
                <strong>Analysis Path:</strong> {sourceNode} → {targetNode}
                <div className="text-xs text-muted-foreground mt-1">
                  Will find both shortest and longest paths
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Number of Paths */}
        <div className="space-y-2">
          <Label>Number of Paths (K)</Label>
          <Input
            type="number"
            min="1"
            max="10"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value) || 1)}
            placeholder="Enter number of paths"
          />
          <div className="text-xs text-muted-foreground">
            Find top {topK} shortest AND {topK} longest paths (1-10 paths each type)
          </div>
        </div>

        {/* Hypergraph Options */}
        <div className="space-y-4">
          <Separator />
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="use-hypergraph"
              checked={useHypergraph}
              onChange={(e) => setUseHypergraph(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="use-hypergraph">Use Hypergraph Visualization</Label>
          </div>
          
          {useHypergraph && (
            <div className="space-y-2">
              <Label>Max Nodes per Hypernode</Label>
              <Input
                type="number"
                min="2"
                max="20"
                value={maxPerHypernode}
                onChange={(e) => setMaxPerHypernode(parseInt(e.target.value) || 4)}
                placeholder="Max nodes per hypernode"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handleFindPaths} 
            disabled={isLoading || 
                     (!useFullDatabase && !selectedAOP) || 
                     (pathfindingMode === 'custom' && (!sourceNode || !targetNode))
            }
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {isLoading ? 'Searching...' : 'Find Paths'}
          </Button>
          
          {(shortestPaths || longestPaths) && (
            <Button variant="outline" onClick={clearResults}>
              Clear Results
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Display - Shortest Paths */}
        {shortestPaths && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Shortest Paths
              </h4>
              
              {shortestPaths.paths && shortestPaths.paths.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Found: {shortestPaths.paths.length} shortest paths
                    </Badge>
                    {shortestPaths.total_found && (
                      <Badge variant="outline">
                        Total: {shortestPaths.total_found}
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-green-50">
                      Shortest
                    </Badge>
                    {shortestPaths.database_stats?.used_full_database && (
                      <Badge variant="outline">
                        <Database className="h-3 w-3 mr-1" />
                        Full DB
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {shortestPaths.paths.map((path, index) => (
                      <div key={index} className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                        <div className="font-medium">
                          Path {index + 1} (Length: {path.length})
                        </div>
                        {pathfindingMode === 'mie_to_ao' ? (
                          <div className="text-muted-foreground text-xs">
                            {path.mie_node} → {path.ao_node}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-xs">
                            {path.source_node} → {path.target_node}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {path.path.join(' → ')}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {useHypergraph && shortestPaths.hypergraph_data && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onHypergraphVisualize(shortestPaths.hypergraph_data)}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Shortest Paths Hypergraph
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  No shortest paths found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Display - Longest Paths */}
        {longestPaths && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Longest Paths
              </h4>
              
              {longestPaths.paths && longestPaths.paths.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Found: {longestPaths.paths.length} longest paths
                    </Badge>
                    {longestPaths.total_found && (
                      <Badge variant="outline">
                        Total: {longestPaths.total_found}
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-blue-50">
                      Longest
                    </Badge>
                    {longestPaths.database_stats?.used_full_database && (
                      <Badge variant="outline">
                        <Database className="h-3 w-3 mr-1" />
                        Full DB
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {longestPaths.paths.map((path, index) => (
                      <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <div className="font-medium">
                          Path {index + 1} (Length: {path.length})
                        </div>
                        {pathfindingMode === 'mie_to_ao' ? (
                          <div className="text-muted-foreground text-xs">
                            {path.mie_node} → {path.ao_node}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-xs">
                            {path.source_node} → {path.target_node}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {path.path.join(' → ')}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {useHypergraph && longestPaths.hypergraph_data && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onHypergraphVisualize(longestPaths.hypergraph_data)}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Longest Paths Hypergraph
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  No longest paths found.
                </div>
              )}

              {/* Database Stats */}
              {longestPaths.database_stats && (
                <div className="mt-4 p-2 bg-muted/50 rounded text-xs">
                  <div className="font-medium mb-1">Search Statistics:</div>
                  <div>Database: {longestPaths.database_stats.total_nodes} nodes, {longestPaths.database_stats.total_edges} edges</div>
                  <div>MIE nodes: {longestPaths.database_stats.mie_nodes}, AO nodes: {longestPaths.database_stats.ao_nodes}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {!isLoading && !shortestPaths && !longestPaths && !error && (
          <div className="text-center text-muted-foreground py-8">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No pathfinding analysis performed yet.</p>
            <p className="text-xs">Select source and target nodes, then click "Find Paths"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PathfindingPanel;
