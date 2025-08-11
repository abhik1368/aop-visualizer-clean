import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Network, 
  GitBranch, 
  Layers, 
  Settings, 
  Zap, 
  Target,
  Users,
  Filter,
  Palette
} from 'lucide-react';

const HypergraphControls = ({ 
  onHypergraphToggle, 
  onMinNodesChange, 
  onLayoutChange,
  onCommunityDetection,
  // Removed onNodeGrouping and nodeGroupingEnabled props - redundant with hypergraph toggle
  graphData,
  hypergraphEnabled = false,
  minNodes = 4,
  layoutType = 'forceatlas2',
  communityMethod = 'louvain'
}) => {
  const [localMinNodes, setLocalMinNodes] = useState(minNodes);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [communityStats, setCommunityStats] = useState(null);

  // Layout options with descriptions - using reliable built-in layouts
  const layoutOptions = [
    { value: 'forceatlas2', label: 'ForceAtlas2', description: 'Physics-based with good separation' },
    { value: 'cose-bilkent', label: 'COSE Bilkent', description: 'Compound spring embedder' },
    { value: 'grid', label: 'Grid', description: 'Organized grid layout' },
    { value: 'circle', label: 'Circle', description: 'Circular arrangement' },
    { value: 'concentric', label: 'Concentric', description: 'Concentric circles by importance' },
    { value: 'breadthfirst', label: 'Hierarchical', description: 'Tree-like hierarchical layout' }
  ];

  // Community detection methods
  const communityMethods = [
    { value: 'louvain', label: 'Louvain', description: 'Modularity optimization' },
    { value: 'leiden', label: 'Leiden', description: 'Improved Louvain algorithm' },
    { value: 'walktrap', label: 'Walktrap', description: 'Random walk based' },
    { value: 'infomap', label: 'Infomap', description: 'Information flow based' },
    { value: 'spectral', label: 'Spectral', description: 'Eigenvalue decomposition' }
  ];

  // Node type colors and statistics
  const nodeTypeStats = React.useMemo(() => {
    if (!graphData?.nodes) return {};
    
    const stats = {};
    graphData.nodes.forEach(node => {
      const type = node.type || 'Unknown';
      if (!stats[type]) {
        stats[type] = { count: 0, color: getNodeTypeColor(type) };
      }
      stats[type].count++;
    });
    return stats;
  }, [graphData]);

  function getNodeTypeColor(type) {
    const colors = {
      'MolecularInitiatingEvent': '#10b981',
      'KeyEvent': '#3b82f6',
      'AdverseOutcome': '#ec4899',
      'default': '#6b7280'
    };
    return colors[type] || colors.default;
  }

  const handleMinNodesChange = (value) => {
    setLocalMinNodes(value[0]);
    onMinNodesChange?.(value[0]);
  };

  const handleCommunityDetection = async () => {
    try {
      const result = await onCommunityDetection?.(communityMethod);
      setCommunityStats(result);
    } catch (error) {
      console.error('Community detection failed:', error);
    }
  };

  return (
    <Card className="p-4 space-y-4 bg-card/95 backdrop-blur-sm border-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Hypergraph Controls</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Hypergraph Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Enable Hypergraph</span>
        </div>
        <Switch
          checked={hypergraphEnabled}
          onCheckedChange={onHypergraphToggle}
        />
      </div>

      {hypergraphEnabled && (
        <>
          <Separator />
          
          {/* Minimum Nodes for Hyperedges */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Min Nodes per Hyperedge</span>
              </div>
              <Badge variant="secondary">{localMinNodes}</Badge>
            </div>
            <Slider
              value={[localMinNodes]}
              onValueChange={handleMinNodesChange}
              max={20}
              min={2}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Hyperedges will only be created for groups with at least {localMinNodes} nodes
            </p>
          </div>

          <Separator />

          {/* Removed "Group by Node Type" toggle - redundant with hypergraph toggle */}

          {/* Node Type Statistics */}
          {hypergraphEnabled && Object.keys(nodeTypeStats).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Node Types</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(nodeTypeStats).map(([type, stats]) => (
                  <div key={type} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: stats.color }}
                      />
                      <span className="text-xs font-medium">{type}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stats.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Layout Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Layout Algorithm</span>
            </div>
            <Select value={layoutType} onValueChange={onLayoutChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent>
                {layoutOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Community Detection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Community Detection</span>
            </div>
            <div className="flex gap-2">
              <Select value={communityMethod} onValueChange={(value) => setCommunityMethod?.(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {communityMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      <div>
                        <div className="font-medium">{method.label}</div>
                        <div className="text-xs text-muted-foreground">{method.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCommunityDetection}
                disabled={!graphData?.nodes?.length}
              >
                Detect
              </Button>
            </div>
            
            {communityStats && (
              <div className="p-2 bg-muted/50 rounded text-xs">
                <div className="flex justify-between">
                  <span>Communities found:</span>
                  <Badge variant="secondary">{communityStats.communities}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Modularity:</span>
                  <Badge variant="secondary">{communityStats.modularity?.toFixed(3)}</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Advanced Options</span>
                </div>
                
                {/* Edge Weight Threshold */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Edge Weight Threshold</label>
                  <Slider
                    defaultValue={[0.1]}
                    max={1}
                    min={0}
                    step={0.05}
                    className="w-full"
                  />
                </div>

                {/* Node Size Scaling */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Node Size Scaling</label>
                  <Slider
                    defaultValue={[1]}
                    max={3}
                    min={0.5}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Hyperedge Opacity */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Hyperedge Opacity</label>
                  <Slider
                    defaultValue={[0.6]}
                    max={1}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Graph Statistics */}
      {graphData && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-lg">{graphData.nodes?.length || 0}</div>
              <div className="text-muted-foreground">Nodes</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{graphData.edges?.length || 0}</div>
              <div className="text-muted-foreground">Edges</div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default HypergraphControls;
