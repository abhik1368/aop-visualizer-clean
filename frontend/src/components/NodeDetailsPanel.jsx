import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, BookOpen, Search } from 'lucide-react';
import axios from 'axios';

const NodeDetailsPanel = ({ selectedNode, selectedEdge, graphData }) => {
  const [nodeDetails, setNodeDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Use selectedNode as the primary node source
  const node = selectedNode;

  // Function to find all AOPs that contain this node
  const getConnectedAOPs = (nodeId) => {
    if (!node) return [];
    
    const connectedAOPs = new Set();
    
    // Primary source: Use aop_sources from merged data (most comprehensive)
    if (node.aop_sources && Array.isArray(node.aop_sources)) {
      node.aop_sources.forEach(aop => connectedAOPs.add(aop));
      console.log(`Node ${nodeId} belongs to AOPs from aop_sources:`, node.aop_sources);
    }
    
    // Fallback 1: Use node's own AOP property
    if (node.aop) {
      connectedAOPs.add(node.aop);
      console.log(`Node ${nodeId} has direct AOP property:`, node.aop);
    }
    
    // Fallback 2: Search through edges for AOP information
    if (graphData && graphData.edges) {
      graphData.edges.forEach(edge => {
        if (edge.source === nodeId || edge.target === nodeId) {
          if (edge.aop) {
            connectedAOPs.add(edge.aop);
          }
          if (edge.aop_sources && Array.isArray(edge.aop_sources)) {
            edge.aop_sources.forEach(aop => connectedAOPs.add(aop));
          }
        }
      });
    }
    
    // Fallback 3: Search through all nodes for any that mention this node
    if (graphData && graphData.nodes) {
      graphData.nodes.forEach(n => {
        if (n.id === nodeId && n.aop_sources) {
          if (Array.isArray(n.aop_sources)) {
            n.aop_sources.forEach(aop => connectedAOPs.add(aop));
          }
        }
      });
    }
    
    const result = Array.from(connectedAOPs).sort((a, b) => {
      // Sort numerically if both are numbers, otherwise alphabetically
      const numA = parseInt(a.toString().match(/\d+/)?.[0]);
      const numB = parseInt(b.toString().match(/\d+/)?.[0]);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.toString().localeCompare(b.toString());
    });
    
    console.log(`Final connected AOPs for node ${nodeId}:`, result);
    return result;
  };

  useEffect(() => {
    if (node?.id) {
      // For now, we'll use the node data directly since we have all metadata
      // In the future, we could still make API calls for additional details
      setNodeDetails(node);
      setLoading(false);
    } else {
      setNodeDetails(null);
    }
  }, [node]);

  const handlePublicationSearch = () => {
    if (node?.label) {
      // Open PubMed search in new tab
      const query = encodeURIComponent(node.label);
      window.open(`https://pubmed.ncbi.nlm.nih.gov/?term=${query}`, '_blank');
    }
  };

  const handleDiseaseSearch = () => {
    if (node?.label) {
      // Open disease database search in new tab
      const query = encodeURIComponent(node.label);
      window.open(`https://www.omim.org/search?index=entry&start=1&limit=10&search=${query}`, '_blank');
    }
  };

  const getNodeTypeColor = (type) => {
    switch (type) {
      case 'MolecularInitiatingEvent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'KeyEvent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'AdverseOutcome':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getNodeTypeLabel = (type) => {
    switch (type) {
      case 'MolecularInitiatingEvent':
        return 'MIE';
      case 'KeyEvent':
        return 'KE';
      case 'AdverseOutcome':
        return 'AO';
      default:
        return type;
    }
  };

  if (!node) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          Select a node to view details
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Node Details</h3>
        
        {/* Basic Information */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getNodeTypeColor(node.type)}>
                {getNodeTypeLabel(node.type)}
              </Badge>
              <span className="text-sm text-muted-foreground">Event ID: {node.id}</span>
            </div>
            <h4 className="font-medium text-base">{node.label}</h4>
          </div>

          {/* Enhanced AOP Information with Cross-Pathway Analysis */}
          {(() => {
            const connectedAOPs = getConnectedAOPs(node.id);
            const aopAssociations = node.aop_associations || [];
            const crossPathwayCount = node.cross_pathway_count || 0;
            const isCrossPathway = node.is_cross_pathway || false;
            
            if (connectedAOPs.length > 0 || aopAssociations.length > 0 || node.aop || node.aop_source || node.aop_title) {
              return (
                <div className={`p-3 rounded-md ${isCrossPathway ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <label className={`text-sm font-medium ${isCrossPathway ? 'text-purple-800 dark:text-purple-200' : 'text-blue-800 dark:text-blue-200'}`}>
                      AOP Network Information
                    </label>
                    {isCrossPathway && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                        🔗 Cross-Pathway
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3 mt-2">
                    {/* Cross-pathway highlighting */}
                    {isCrossPathway && crossPathwayCount > 1 && (
                      <div className="bg-purple-100 dark:bg-purple-800/30 p-2 rounded border border-purple-200 dark:border-purple-700">
                        <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                          🌐 Cross-Pathway Node
                        </div>
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                          This node appears across <strong>{crossPathwayCount} different AOP pathways</strong>, indicating its importance in multiple biological processes.
                        </div>
                      </div>
                    )}
                    
                    {/* AOP Associations (from comprehensive search) */}
                    {aopAssociations.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Pathway Associations:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {aopAssociations.map((aop, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className={`text-xs ${isCrossPathway ? 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-800 dark:text-purple-100' : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100'}`}
                            >
                              {aop}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Appears in {aopAssociations.length} AOP pathway{aopAssociations.length !== 1 ? 's' : ''} (comprehensive analysis)
                        </div>
                      </div>
                    )}
                    
                    {/* Legacy connected AOPs */}
                    {connectedAOPs.length > 0 && aopAssociations.length === 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Connected AOPs:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {connectedAOPs.map((aop, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100"
                            >
                              {aop}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          This node appears in {connectedAOPs.length} AOP{connectedAOPs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                    
                    {node.aop_title && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">AOP Title:</span>
                        <div className="mt-1">{node.aop_title}</div>
                      </div>
                    )}
                    
                    {node.aop_source && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Primary AOP:</span> {node.aop_source}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Node Properties */}
          <div className="space-y-2">
            {node.change && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Change</label>
                <div className="text-sm">{node.change}</div>
              </div>
            )}

            {node.ontology && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ontology</label>
                <div className="text-sm">{node.ontology}</div>
              </div>
            )}

            {node.ontology_term && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ontology Term</label>
                <div className="text-sm">{node.ontology_term}</div>
              </div>
            )}

            {node.ontology_id && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ontology ID</label>
                <div className="text-sm">{node.ontology_id}</div>
              </div>
            )}

            {node.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="text-sm">{node.description}</div>
              </div>
            )}

            {/* Enhanced Search Match Information */}
            {node.is_search_match && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">
                    🎯 Direct Search Match
                  </div>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                    Relevant
                  </Badge>
                </div>
                
                {node.matched_terms && node.matched_terms.length > 0 && (
                  <div className="text-xs text-green-700 dark:text-green-300 mb-2">
                    <div className="font-medium mb-1">Matched terms:</div>
                    <div className="flex flex-wrap gap-1">
                      {node.matched_terms.slice(0, 5).map((term, index) => (
                        <span key={index} className="bg-green-100 dark:bg-green-800/30 px-2 py-1 rounded text-xs">
                          {term}
                        </span>
                      ))}
                      {node.matched_terms.length > 5 && (
                        <span className="text-green-600 dark:text-green-400">
                          +{node.matched_terms.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {node.search_query && (
                  <div className="text-xs text-green-700 dark:text-green-300">
                    Original query: "{node.search_query}"
                  </div>
                )}
                
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  This node was identified as directly relevant to your biological term search.
                </div>
              </div>
            )}

            {/* Additional Metadata */}
            {Object.entries(node).filter(([key, value]) => 
              !['id', 'label', 'type', 'aop', 'aop_source', 'aop_title', 'change', 'ontology', 'ontology_term', 'ontology_id', 'description', 'is_search_match', 'search_query', 'isHyper', 'parent', 'community'].includes(key) && 
              value !== null && value !== undefined && value !== ''
            ).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <div className="text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>



        <Separator className="my-4" />

        {/* Action Buttons */}
        <div className="space-y-2">
          <h5 className="font-medium">External Resources</h5>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePublicationSearch}
              className="justify-start"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Search Publications
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiseaseSearch}
              className="justify-start"
            >
              <Search className="h-4 w-4 mr-2" />
              Disease Information
            </Button>
            {node.ontology_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.ebi.ac.uk/ols/search?q=${node.ontology_id}`, '_blank')}
                className="justify-start"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in OLS
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default NodeDetailsPanel;

