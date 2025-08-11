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

  // Function to find all AOPs connected to this node
  const getConnectedAOPs = (nodeId) => {
    if (!graphData || !graphData.nodes || !graphData.edges) return [];
    
    const connectedAOPs = new Set();
    
    // Find all edges connected to this node
    graphData.edges.forEach(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        if (edge.aop) {
          connectedAOPs.add(edge.aop);
        }
      }
    });
    
    // Also include the node's own AOP
    if (node?.aop) {
      connectedAOPs.add(node.aop);
    }
    
    return Array.from(connectedAOPs).sort();
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

          {/* AOP Information */}
          {(node.aop || node.aop_source || node.aop_title) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
              <label className="text-sm font-medium text-blue-800 dark:text-blue-200">AOP Information</label>
              <div className="space-y-1 mt-1">
                {(() => {
                  const connectedAOPs = getConnectedAOPs(node.id);
                  return connectedAOPs.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Connected AOPs:</span> {connectedAOPs.join(', ')}
                    </div>
                  );
                })()}
                {node.aop_title && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">AOP Title:</span> {node.aop_title}
                  </div>
                )}
              </div>
            </div>
          )}

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

            {/* Search Match Information */}
            {node.is_search_match && (
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                <div className="text-sm text-green-800 dark:text-green-200">
                  ✅ Search Match
                  {node.search_query && (
                    <div className="text-xs mt-1">Query: "{node.search_query}"</div>
                  )}
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

