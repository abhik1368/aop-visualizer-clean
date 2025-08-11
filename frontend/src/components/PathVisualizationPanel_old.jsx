import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Route, ArrowRight, Download, Search, X } from 'lucide-react';

const PathVisualizationPanel = ({ pathResults, nodePathData, onPathHighlight }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter function for paths based on search term
  const filterPaths = (paths, searchTerm) => {
    if (!searchTerm.trim()) return paths;
    
    const search = searchTerm.toLowerCase();
    return paths.filter(path => {
      // Search in node labels/names
      const nodeMatch = path.nodes?.some(node => 
        (node.label?.toLowerCase().includes(search)) ||
        (node.id?.toLowerCase().includes(search)) ||
        (node.type?.toLowerCase().includes(search))
      );
      
      // Search in path metadata
      const metaMatch = 
        path.mieNode?.label?.toLowerCase().includes(search) ||
        path.aoNode?.label?.toLowerCase().includes(search) ||
        path.targetNode?.label?.toLowerCase().includes(search) ||
        path.id?.toLowerCase().includes(search);
      
      return nodeMatch || metaMatch;
    });
  };

  // Show node-specific paths if available, otherwise show regular path results
  if (nodePathData && nodePathData.pathsForNode && nodePathData.selectedNodePaths.length > 0) {
    const filteredNodePaths = useMemo(() => 
      filterPaths(nodePathData.selectedNodePaths, searchTerm), 
      [nodePathData.selectedNodePaths, searchTerm]
    );
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Route className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            Paths Through Node: {nodePathData.pathsForNode.title || nodePathData.pathsForNode.name || nodePathData.pathsForNode.id}
          </h3>
        </div>

        {/* Search functionality */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search paths by node name, type, or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search results summary */}
        {searchTerm && (
          <div className="text-sm text-gray-600 mb-3">
            Showing {filteredNodePaths.length} of {nodePathData.selectedNodePaths.length} paths
            {filteredNodePaths.length === 0 && (
              <span className="text-orange-600 ml-2">- No paths match your search</span>
            )}
          </div>
        )}

        {nodePathData.isCalculatingPaths ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Calculating paths...</span>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Badge variant="secondary" className="text-sm">
                {filteredNodePaths.length} paths found from MIE to AO
                {searchTerm && ` (filtered from ${nodePathData.selectedNodePaths.length})`}
              </Badge>
            </div>

            {filteredNodePaths.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {searchTerm ? 'No paths match your search criteria.' : 'No paths found.'}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredNodePaths.map((path, index) => (
                    <Card key={index} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={getPathColor(index)} variant="outline">
                          Path {index + 1}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Length: {path.length}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPathHighlight && onPathHighlight(index)}
                        className="text-xs"
                      >
                        Highlight
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-green-700">MIE:</span>{' '}
                        {path.nodeData[0]?.title || path.nodeData[0]?.name || path.nodes[0]}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600 overflow-x-auto">
                        {path.nodes.map((nodeId, nodeIndex) => {
                          const nodeData = path.nodeData[nodeIndex];
                          const isTargetNode = nodeId === nodePathData.pathsForNode.id;
                          
                          return (
                            <React.Fragment key={nodeId}>
                              <span 
                                className={`whitespace-nowrap ${
                                  isTargetNode 
                                    ? 'font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded' 
                                    : 'text-gray-700'
                                }`}
                                title={nodeData?.description || ''}
                              >
                                {nodeData?.title || nodeData?.name || nodeId}
                              </span>
                              {nodeIndex < path.nodes.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <div className="text-sm">
                        <span className="font-medium text-red-700">AO:</span>{' '}
                        {path.nodeData[path.nodeData.length - 1]?.title || 
                         path.nodeData[path.nodeData.length - 1]?.name || 
                         path.nodes[path.nodes.length - 1]}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportNodePathsAsCSV(nodePathData)}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Paths as CSV
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Fallback to regular path results display
  if (!pathResults) return null;

  const getPathColor = (pathIndex) => {
    const colors = [
      'bg-red-100 text-red-800 border-red-200',
      'bg-blue-100 text-blue-800 border-blue-200', 
      'bg-green-100 text-green-800 border-green-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-orange-100 text-orange-800 border-orange-200'
    ];
    return colors[pathIndex % colors.length];
  };

  const formatNodeName = (node) => {
    return node.label || node.id;
  };

  const exportNodePathsAsCSV = (nodePathData) => {
    if (!nodePathData || !nodePathData.selectedNodePaths || nodePathData.selectedNodePaths.length === 0) return;

    const headers = [
      'Path_Index',
      'Path_Length',
      'Source_MIE',
      'Target_AO',
      'Via_Node',
      'Full_Path_Labels',
      'Full_Path_IDs',
      'Node_Types_Sequence'
    ];

    const rows = nodePathData.selectedNodePaths.map((path, index) => {
      const pathLabels = path.nodeData?.map(node => node?.title || node?.name || node?.id).join(' → ') || '';
      const pathIds = path.nodes?.join(' → ') || '';
      const nodeTypes = path.nodeData?.map(node => node?.type || 'Unknown').join(' → ') || '';
      
      const sourceMIE = path.nodeData?.[0]?.title || path.nodeData?.[0]?.name || path.nodes?.[0] || '';
      const targetAO = path.nodeData?.[path.nodeData.length - 1]?.title || 
                      path.nodeData?.[path.nodeData.length - 1]?.name || 
                      path.nodes?.[path.nodes.length - 1] || '';
      const viaNode = nodePathData.pathsForNode?.title || nodePathData.pathsForNode?.name || nodePathData.pathsForNode?.id || '';

      return [
        index + 1,
        path.length || path.nodes?.length || 0,
        sourceMIE,
        targetAO,
        viaNode,
        pathLabels,
        pathIds,
        nodeTypes
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const viaNodeName = (nodePathData.pathsForNode?.title || nodePathData.pathsForNode?.name || nodePathData.pathsForNode?.id || 'node').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `paths_through_${viaNodeName}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPathsAsCSV = () => {
    if (!pathResults || !pathResults.paths) return;

    const isDirectionalPaths = pathResults.type === 'directional_paths_through_node';
    
    // Prepare CSV headers
    const headers = [
      'Path_Index',
      'Pathway_Type',
      'Path_Length',
      'Source_MIE',
      'Target_AO',
      'Via_Node',
      'Full_Path_Labels',
      'Full_Path_IDs',
      'Node_Types_Sequence'
    ];

    // Prepare CSV rows
    const rows = pathResults.paths.map((path, index) => {
      const pathLabels = path.nodes?.map(node => node.label || node.id).join(' → ') || '';
      const pathIds = path.path?.join(' → ') || path.nodes?.map(node => node.id).join(' → ') || '';
      const nodeTypes = path.nodes?.map(node => node.type || 'Unknown').join(' → ') || '';
      
      return [
        path.path_index || (index + 1),
        path.pathway_type || 'Standard Path',
        path.length || path.weight || path.nodes?.length || 0,
        path.mie_label || pathResults.source || '',
        path.ao_label || pathResults.target || '',
        path.via_node || pathResults.via_node || '',
        `"${pathLabels}"`,
        `"${pathIds}"`,
        `"${nodeTypes}"`
      ];
    });

    // Create CSV content
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = isDirectionalPaths ? 
      `directional-pathways-${pathResults.via_node}-${timestamp}.csv` :
      `k-shortest-paths-${timestamp}.csv`;
    
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  if (pathResults.type === 'shortest_path') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Shortest Path Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50">
                Length: {pathResults.length} steps
              </Badge>
              {pathResults.bidirectional && (
                <Badge variant="outline" className="bg-green-50">
                  Bidirectional
                </Badge>
              )}
            </div>
            
            <div className="p-3 bg-gray-50 rounded border">
              <div className="flex flex-wrap items-center gap-2">
                {pathResults.nodes?.map((node, index) => (
                  <React.Fragment key={node.id}>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500">{node.type}</span>
                      <span className="font-medium text-sm">{formatNodeName(node)}</span>
                    </div>
                    {index < pathResults.nodes.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pathResults.type === 'k_shortest_paths' || pathResults.type === 'directional_paths_through_node') {
    const isDirectionalPaths = pathResults.type === 'directional_paths_through_node';
    
    // Filtered paths for regular path results
    const filteredRegularPaths = useMemo(() => {
      if (!pathResults || !pathResults.paths) return [];
      return filterPaths(pathResults.paths, searchTerm);
    }, [pathResults, searchTerm]);
    
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            {isDirectionalPaths ? 'Directional Pathways' : 'K-Shortest Paths'} 
            ({pathResults.count} found)
          </CardTitle>
          {isDirectionalPaths && (
            <div className="text-sm text-gray-600">
              {pathResults.directionality_info}
            </div>
          )}
          <div className="mt-2">
            <Button 
              onClick={exportPathsAsCSV}
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export as CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search functionality */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search paths by node name, type, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search results summary */}
          {searchTerm && (
            <div className="text-sm text-gray-600 mb-3">
              Showing {filteredRegularPaths.length} of {pathResults.paths?.length || 0} paths
              {filteredRegularPaths.length === 0 && (
                <span className="text-orange-600 ml-2">- No paths match your search</span>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline" className="bg-blue-50">
                Total Paths: {filteredRegularPaths.length}
                {searchTerm && ` (filtered from ${pathResults.count})`}
              </Badge>
              {isDirectionalPaths && (
                <>
                  <Badge variant="outline" className="bg-green-50">
                    Via: {pathResults.via_node} ({pathResults.via_node_type})
                  </Badge>
                  {pathResults.analysis && (
                    <>
                      <Badge variant="outline" className="bg-purple-50">
                        MIE Nodes: {pathResults.analysis.unique_mie_nodes}
                      </Badge>
                      <Badge variant="outline" className="bg-orange-50">
                        AO Nodes: {pathResults.analysis.unique_ao_nodes}
                      </Badge>
                    </>
                  )}
                </>
              )}
              {pathResults.bidirectional && (
                <Badge variant="outline" className="bg-green-50">
                  Bidirectional Search
                </Badge>
              )}
            </div>

            {filteredRegularPaths.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {searchTerm ? 'No paths match your search criteria.' : 'No paths found.'}
              </div>
            ) : (
              filteredRegularPaths.map((path, pathIndex) => (
              <div 
                key={pathIndex}
                className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onPathHighlight && onPathHighlight(pathIndex)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getPathColor(pathIndex)}>
                      Path {path.path_index || pathIndex + 1}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Length: {path.length || path.weight} steps
                    </span>
                    {isDirectionalPaths && path.pathway_type && (
                      <Badge variant="outline" className="bg-yellow-50">
                        {path.pathway_type}
                      </Badge>
                    )}
                  </div>
                  {isDirectionalPaths && (
                    <div className="text-xs text-gray-500">
                      {path.mie_label} → {path.ao_label}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {path.nodes?.map((node, nodeIndex) => (
                    <React.Fragment key={node.id}>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 text-xs">{node.type}</span>
                        <span className="font-medium">{formatNodeName(node)}</span>
                      </div>
                      {nodeIndex < path.nodes.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Show path edges info */}
                <div className="mt-2 text-xs text-gray-500">
                  {path.edges?.length > 0 && (
                    <span>
                      Confidence levels: {path.edges.map(edge => edge.confidence || 'N/A').join(' → ')}
                    </span>
                  )}
                </div>
              </div>
            ))
            )}

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="text-blue-700">
                <strong>Tip:</strong> {isDirectionalPaths ? 
                  `${searchTerm ? `${filteredRegularPaths.length} of ${pathResults.count}` : `All ${pathResults.count}`} directional pathways through ${pathResults.via_node} are shown above. Each path respects MIE → KE → AO directionality.` :
                  `${searchTerm ? `${filteredRegularPaths.length} of ${pathResults.count}` : `All ${pathResults.count}`} paths are visualized in the graph above. Each path uses different colored edges.`
                } Click on a path below to highlight it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default PathVisualizationPanel;
