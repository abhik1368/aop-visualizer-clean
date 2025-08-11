import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Download, Route, ChevronRight, Filter } from 'lucide-react';

const PathVisualizationPanel = ({ 
  pathResults, 
  onPathHover, 
  onPathSelect, 
  highlightedPath,
  nodePathData
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  console.log('PathVisualizationPanel Debug:', {
    nodePathData,
    hasNodePathData: !!nodePathData,
    hasPathsForNode: !!(nodePathData && nodePathData.pathsForNode),
    hasSelectedNodePaths: !!(nodePathData && nodePathData.selectedNodePaths),
    selectedNodePathsLength: nodePathData?.selectedNodePaths?.length || 0,
    isCalculatingPaths: nodePathData?.isCalculatingPaths,
    pathResults
  });

  // Node path data display (when a node is clicked)
  if (nodePathData && nodePathData.selectedNodePaths && nodePathData.selectedNodePaths.length > 0) {
    const filterNodePaths = (paths, term) => {
      if (!term) return paths;
      const lowerTerm = term.toLowerCase();
      
      return paths.filter(path => {
        // Search in path nodes
        const pathText = path.nodes.map(node => 
          `${node.title || node.name || node.id} ${node.type || ''}`
        ).join(' ').toLowerCase();
        
        // Search in metadata
        const metadataText = Object.values(path.metadata || {}).join(' ').toLowerCase();
        
        return pathText.includes(lowerTerm) || metadataText.includes(lowerTerm);
      });
    };

    const filteredNodePaths = filterNodePaths(nodePathData.selectedNodePaths, searchTerm);

    const exportNodePathsAsCSV = () => {
      if (!nodePathData.selectedNodePaths) return;
      
      const csvData = nodePathData.selectedNodePaths.map((path, index) => ({
        'Path ID': index + 1,
        'Length': path.nodes.length,
        'Total Weight': path.totalWeight?.toFixed(3) || 'N/A',
        'Path': path.nodes.map(node => node.title || node.name || node.id).join(' → '),
        'Node Types': path.nodes.map(node => node.type || 'Unknown').join(' → '),
        'Via Node': nodePathData.pathsForNode?.title || nodePathData.pathsForNode?.name || nodePathData.pathsForNode?.id || 'Unknown'
      }));

      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `node_paths_${nodePathData.pathsForNode?.id || 'selected'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Route className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            Paths Through: {nodePathData.pathsForNode?.title || nodePathData.pathsForNode?.name || nodePathData.pathsForNode?.id}
          </h3>
        </div>

        {nodePathData.isCalculatingPaths ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Calculating paths...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search paths by node names, types, or metadata..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                <Filter className="h-3 w-3 mr-1" />
                {filteredNodePaths.length} of {nodePathData.selectedNodePaths.length}
              </Badge>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredNodePaths.map((path, index) => (
                <Card 
                  key={index} 
                  className={`cursor-pointer transition-all ${highlightedPath === index ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'}`}
                  onClick={() => onPathSelect?.(index)}
                  onMouseEnter={() => onPathHover?.(index)}
                  onMouseLeave={() => onPathHover?.(null)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        Path {nodePathData.selectedNodePaths.indexOf(path) + 1}
                      </Badge>
                      {path.totalWeight && (
                        <Badge variant="secondary" className="text-xs">
                          Weight: {path.totalWeight.toFixed(3)}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center flex-wrap gap-1 text-sm">
                        {path.nodes.map((node, nodeIndex) => (
                          <React.Fragment key={nodeIndex}>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              node.type === 'MolecularInitiatingEvent' ? 'bg-green-100 text-green-800' :
                              node.type === 'KeyEvent' ? 'bg-blue-100 text-blue-800' :
                              node.type === 'AdverseOutcome' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {node.title || node.name || node.id}
                            </span>
                            {nodeIndex < path.nodes.length - 1 && (
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      
                      {path.metadata && Object.keys(path.metadata).length > 0 && (
                        <div className="text-xs text-gray-600 mt-2">
                          {Object.entries(path.metadata).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              <strong>{key}:</strong> {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="text-blue-700">
                <strong>Found {nodePathData.selectedNodePaths.length} complete MIE → AO pathways</strong> passing through the selected node. 
                {searchTerm && ` Showing ${filteredNodePaths.length} matching your search.`}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={exportNodePathsAsCSV}
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

  // Show message when node is selected but no paths found
  if (nodePathData && nodePathData.pathsForNode && !nodePathData.isCalculatingPaths && 
      (!nodePathData.selectedNodePaths || nodePathData.selectedNodePaths.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Route className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            Paths Through: {nodePathData.pathsForNode.title || nodePathData.pathsForNode.name || nodePathData.pathsForNode.id}
          </h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          <p>No complete MIE → AO paths found through this node.</p>
          <p className="text-sm mt-2">The selected node may not be part of any complete pathways, or there may be no connecting edges.</p>
        </div>
      </div>
    );
  }

  // Show calculating state
  if (nodePathData && nodePathData.isCalculatingPaths) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Route className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">
            Calculating Paths Through: {nodePathData.pathsForNode?.title || nodePathData.pathsForNode?.name || nodePathData.pathsForNode?.id || 'Selected Node'}
          </h3>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Calculating paths...</span>
        </div>
      </div>
    );
  }

  // Fallback to regular path results display
  if (!pathResults) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No path analysis available.</p>
        <p className="text-sm mt-2">Click on a node to find all MIE → AO paths passing through it.</p>
      </div>
    );
  }

  // Regular path results display (legacy functionality)
  const isDirectionalPaths = pathResults.type === 'directional';
  
  const filterPaths = (paths, term) => {
    if (!term) return paths;
    const lowerTerm = term.toLowerCase();
    
    return paths.filter(path => {
      const pathText = path.map(nodeId => nodeId.toString()).join(' ').toLowerCase();
      return pathText.includes(lowerTerm);
    });
  };

  const filteredRegularPaths = useMemo(() => 
    filterPaths(pathResults.paths || [], searchTerm), 
    [pathResults.paths, searchTerm]
  );

  const exportPathsAsCSV = () => {
    if (!pathResults || !pathResults.paths) return;
    
    const csvData = pathResults.paths.map((path, index) => ({
      'Path ID': index + 1,
      'Length': path.length,
      'Path': path.join(' → '),
      'Type': isDirectionalPaths ? 'Directional' : 'Standard'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paths_${isDirectionalPaths ? 'directional' : 'standard'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isDirectionalPaths ? 'Directional Pathways' : 'Path Analysis'}
          </h3>
          <Badge variant="secondary">
            {pathResults.count} {pathResults.count === 1 ? 'path' : 'paths'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search paths..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              <Filter className="h-3 w-3 mr-1" />
              {filteredRegularPaths.length} of {pathResults.count}
            </Badge>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredRegularPaths.length === 0 && searchTerm ? (
              <div className="text-center text-gray-500 py-4">
                <p>No paths match your search.</p>
              </div>
            ) : (
              filteredRegularPaths.map((path, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded cursor-pointer transition-all ${
                    highlightedPath === index ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onPathSelect?.(index)}
                  onMouseEnter={() => onPathHover?.(index)}
                  onMouseLeave={() => onPathHover?.(null)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Path {index + 1}</span>
                    <Badge variant="outline" className="text-xs">
                      {path.length} nodes
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {path.join(' → ')}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="text-blue-700">
              <strong>Tip:</strong> {isDirectionalPaths ? 
                `${searchTerm ? `${filteredRegularPaths.length} of ${pathResults.count}` : `All ${pathResults.count}`} directional pathways through ${pathResults.via_node} are shown above. Each path respects MIE → KE → AO directionality.` :
                `${searchTerm ? `${filteredRegularPaths.length} of ${pathResults.count}` : `All ${pathResults.count}`} paths are visualized in the graph above. Each path uses different colored edges.`
              } Click on a path below to highlight it.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPathsAsCSV}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PathVisualizationPanel;
