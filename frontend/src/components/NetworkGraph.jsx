import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, Download, Settings } from 'lucide-react';

// Register the layout extension
cytoscape.use(coseBilkent);

const NetworkGraph = ({ 
  data, 
  onNodeSelect, 
  onEdgeSelect, 
  selectedNode, 
  selectedEdge,
  theme = 'light',
  onVisibleNodesChange,
  selectedNodeChain = [],
  searchPanelRef
}) => {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);
  const [layoutName, setLayoutName] = useState('cose-bilkent');

  // Export functions
  const exportAsPNG = () => {
    if (!cy) return;
    
    const png64 = cy.png({
      output: 'base64uri',
      bg: theme === 'dark' ? '#1f2937' : '#ffffff',
      full: true,
      scale: 2
    });
    
    const link = document.createElement('a');
    link.download = `aop-network-${Date.now()}.png`;
    link.href = png64;
    link.click();
  };

  const exportAsCSV = () => {
    if (!data || !data.nodes) return;
    
    // Export nodes
    const nodeHeaders = ['id', 'label', 'type', 'aop', 'ontology', 'ontology_term', 'change'];
    const nodeRows = data.nodes.map(node => [
      node.id || '',
      node.label || '',
      node.type || '',
      node.aop || '',
      node.ontology || '',
      node.ontology_term || '',
      node.change || ''
    ]);
    
    const nodeCSV = [nodeHeaders, ...nodeRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Export edges
    const edgeHeaders = ['source', 'target', 'relationship', 'confidence', 'adjacency', 'aop'];
    const edgeRows = data.edges.map(edge => [
      edge.source || '',
      edge.target || '',
      edge.relationship || '',
      edge.confidence || '',
      edge.adjacency || '',
      edge.aop || ''
    ]);
    
    const edgeCSV = [edgeHeaders, ...edgeRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Download nodes CSV
    const nodeBlob = new Blob([nodeCSV], { type: 'text/csv' });
    const nodeLink = document.createElement('a');
    nodeLink.download = `aop-nodes-${Date.now()}.csv`;
    nodeLink.href = URL.createObjectURL(nodeBlob);
    nodeLink.click();
    
    // Download edges CSV
    const edgeBlob = new Blob([edgeCSV], { type: 'text/csv' });
    const edgeLink = document.createElement('a');
    edgeLink.download = `aop-edges-${Date.now()}.csv`;
    edgeLink.href = URL.createObjectURL(edgeBlob);
    edgeLink.click();
  };
  const nodeColors = {
    'MolecularInitiatingEvent': '#86efac', // light green (matching interactive demo)
    'KeyEvent': '#93c5fd', // light blue (matching interactive demo)
    'AdverseOutcome': '#f9a8d4', // light pink (matching interactive demo)
    'default': '#d1d5db' // light gray (matching interactive demo)
  };

  useEffect(() => {
    console.log('NetworkGraph useEffect triggered with data:', data);
    if (!containerRef.current || !data) {
      console.log('Container or data not available:', { container: !!containerRef.current, data: !!data });
      return;
    }

    console.log('Initializing Cytoscape with nodes:', data.nodes?.length, 'edges:', data.edges?.length);

    // Apply performance limits for large datasets
    const maxNodes = 200; // Performance limit for network visualization
    const maxEdges = 400;
    
    const actualNodes = data.nodes.length > maxNodes ? data.nodes.slice(0, maxNodes) : data.nodes;
    const actualNodeIds = new Set(actualNodes.map(n => n.id));
    const actualEdges = data.edges.filter(edge => 
      actualNodeIds.has(edge.source) && actualNodeIds.has(edge.target)
    ).slice(0, maxEdges);
    
    console.log(`NetworkGraph rendering: ${actualNodes.length} nodes (from ${data.nodes.length}), ${actualEdges.length} edges (from ${data.edges.length})`);
    
    // Report actually rendered nodes to parent for hypergraph
    if (onVisibleNodesChange) {
      onVisibleNodesChange(actualNodes, actualEdges);
    }

    // Initialize Cytoscape
    const cytoscapeInstance = cytoscape({
      container: containerRef.current,
      elements: [
        ...actualNodes.map(node => ({
          data: {
            id: node.id,
            label: node.label || node.id,
            type: node.type || 'default',
            aop: node.aop || '',
            ontology: node.ontology || '',
            ontology_term: node.ontology_term || '',
            change: node.change || ''
          }
        })),
        ...actualEdges.map(edge => ({
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            relationship: edge.relationship || '',
            confidence: edge.confidence || '',
            evidence: edge.evidence || '',
            adjacency: edge.adjacency || ''
          }
        }))
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => {
              const nodeType = ele.data('type');
              return nodeColors[nodeType] || nodeColors.default;
            },
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#1f2937', // dark gray text (matching interactive demo)
            'text-outline-color': '#ffffff', // white outline for better readability
            'text-outline-width': 1,
            'font-size': '12px',
            'font-family': 'Arial, sans-serif',
            'width': (ele) => {
              const label = ele.data('label') || '';
              return Math.max(30, Math.min(100, label.length * 3 + 20));
            },
            'height': (ele) => {
              const label = ele.data('label') || '';
              return Math.max(30, Math.min(60, label.length * 2 + 15));
            },
            'shape': (ele) => {
              const nodeType = ele.data('type');
              switch (nodeType) {
                case 'MolecularInitiatingEvent': return 'triangle';
                case 'KeyEvent': return 'rectangle';
                case 'AdverseOutcome': return 'ellipse';
                default: return 'ellipse';
              }
            },
            'border-width': 2,
            'border-color': '#9ca3af', // subtle gray border (matching interactive demo)
            'text-wrap': 'wrap',
            'text-max-width': '80px'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ff6b35',
            'background-color': '#ff6b35'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': theme === 'dark' ? '#64748b' : '#374151',
            'target-arrow-color': theme === 'dark' ? '#64748b' : '#374151',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2,
            'label': (ele) => {
              const rel = ele.data('relationship');
              return rel ? rel.substring(0, 20) : '';
            },
            'font-size': '10px',
            'color': theme === 'dark' ? '#ffffff' : '#000000',
            'text-background-color': theme === 'dark' ? '#1f2937' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#ff6b35',
            'target-arrow-color': '#ff6b35'
          }
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#ef4444',
            'z-index': 999
          }
        },
        {
          selector: '.highlighted-edge',
          style: {
            'width': 4,
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'opacity': 0.95,
            'z-index': 999
          }
        },
        {
          selector: '.path-node',
          style: {
            'border-width': 4,
            'border-color': '#10b981',
            'background-color': '#10b981',
            'z-index': 1000
          }
        },
        {
          selector: '.path-edge',
          style: {
            'width': 4,
            'line-color': '#10b981',
            'target-arrow-color': '#10b981',
            'opacity': 0.95,
            'z-index': 1000
          }
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.15,
            'z-index': 0
          }
        }
      ],
      layout: {
        name: layoutName,
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 50,
        // cose-bilkent specific options
        nodeRepulsion: 4500,
        idealEdgeLength: 50,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10
      },
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    // Event handlers
    cytoscapeInstance.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = {
        id: node.data('id'),
        label: node.data('label'),
        type: node.data('type'),
        aop: node.data('aop'),
        ontology: node.data('ontology'),
        ontology_term: node.data('ontology_term'),
        change: node.data('change')
      };
      // Modifier-click to add to node chain
      try {
        const e = evt.originalEvent;
        if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
          if (searchPanelRef && searchPanelRef.current && typeof searchPanelRef.current.addToNodeChain === 'function') {
            searchPanelRef.current.addToNodeChain(nodeData.id);
          }
        }
      } catch (err) {
        // no-op
      }
      onNodeSelect && onNodeSelect(nodeData);

      // Highlight MIE→KE→AO chain and fade others
      try {
        const normalizeType = (t) => {
          if (!t) return 'OTHER';
          if (t === 'MIE' || t === 'MolecularInitiatingEvent') return 'MIE';
          if (t === 'KE' || t === 'KeyEvent') return 'KE';
          if (t === 'AO' || t === 'AdverseOutcome') return 'AO';
          return 'OTHER';
        };
        const isMIE = (n) => normalizeType(n.data('type')) === 'MIE';
        const isKE = (n) => normalizeType(n.data('type')) === 'KE';
        const isAO = (n) => normalizeType(n.data('type')) === 'AO';

        const cyLocal = node.cy();
        const startType = normalizeType(node.data('type'));
        let highlightNodes = cyLocal.collection().add(node);

        if (startType === 'MIE') {
          const KEs = node.successors('node').filter(isKE);
          const AOs = KEs.successors('node').filter(isAO);
          highlightNodes = highlightNodes.union(KEs).union(AOs);
        } else if (startType === 'KE') {
          const MIEs = node.predecessors('node').filter(isMIE);
          const AOs = node.successors('node').filter(isAO);
          highlightNodes = highlightNodes.union(MIEs).union(AOs);
        } else if (startType === 'AO') {
          const KEs = node.predecessors('node').filter(isKE);
          const MIEs = KEs.predecessors('node').filter(isMIE);
          highlightNodes = highlightNodes.union(KEs).union(MIEs);
        } else {
          const preds = node.predecessors('node').filter(n => isMIE(n) || isKE(n));
          const succs = node.successors('node').filter(n => isKE(n) || isAO(n));
          highlightNodes = highlightNodes.union(preds).union(succs);
        }

        const highlightEdges = highlightNodes.edgesWith(highlightNodes);

        cyLocal.batch(() => {
          cyLocal.elements().removeClass('highlighted highlighted-edge faded');
          highlightNodes.addClass('highlighted');
          highlightEdges.addClass('highlighted-edge');
          cyLocal.elements().difference(highlightNodes.union(highlightEdges)).addClass('faded');
        });

        // Fit view to highlighted chain
        cyLocal.animate({ fit: { eles: highlightNodes.union(highlightEdges), padding: 80 }, duration: 300 });
      } catch (e) {
        console.warn('Highlight chain failed:', e);
      }
    });

    cytoscapeInstance.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = {
        id: edge.data('id'),
        source: edge.data('source'),
        target: edge.data('target'),
        relationship: edge.data('relationship'),
        confidence: edge.data('confidence'),
        evidence: edge.data('evidence'),
        adjacency: edge.data('adjacency')
      };
      onEdgeSelect && onEdgeSelect(edgeData);
    });

    cytoscapeInstance.on('tap', (evt) => {
      if (evt.target === cytoscapeInstance) {
        // Clicked on background
        onNodeSelect && onNodeSelect(null);
        onEdgeSelect && onEdgeSelect(null);
        // Clear highlight/fade classes
        cytoscapeInstance.batch(() => {
          cytoscapeInstance.elements().removeClass('highlighted highlighted-edge faded');
        });
      }
    });

    setCy(cytoscapeInstance);
    cyRef.current = cytoscapeInstance;

    // Report visible nodes to parent component
    if (onVisibleNodesChange) {
      const visibleNodes = data.nodes || [];
      const visibleEdges = data.edges || [];
      onVisibleNodesChange(visibleNodes, visibleEdges);
    }

    return () => {
      if (cytoscapeInstance) {
        cytoscapeInstance.destroy();
      }
    };
  }, [data, theme, layoutName]);

  // Update selection and dynamic chain highlighting based solely on selectedNode
  useEffect(() => {
    if (!cy) return;

    // Clear previous selections and chain highlights
    cy.elements().removeClass('selected');
    cy.elements().removeClass('highlighted highlighted-edge faded');

    if (selectedNode) {
      const node = cy.getElementById(selectedNode.id);
      if (node && node.length > 0) {
        node.addClass('selected');

        try {
          const normalizeType = (t) => {
            if (!t) return 'OTHER';
            if (t === 'MIE' || t === 'MolecularInitiatingEvent') return 'MIE';
            if (t === 'KE' || t === 'KeyEvent') return 'KE';
            if (t === 'AO' || t === 'AdverseOutcome') return 'AO';
            return 'OTHER';
          };
          const isMIE = (n) => normalizeType(n.data('type')) === 'MIE';
          const isKE = (n) => normalizeType(n.data('type')) === 'KE';
          const isAO = (n) => normalizeType(n.data('type')) === 'AO';

          const cyLocal = cy;
          const startType = normalizeType(node.data('type'));
          let highlightNodes = cyLocal.collection().add(node);

          if (startType === 'MIE') {
            const KEs = node.successors('node').filter(isKE);
            const AOs = KEs.successors('node').filter(isAO);
            highlightNodes = highlightNodes.union(KEs).union(AOs);
          } else if (startType === 'KE') {
            const MIEs = node.predecessors('node').filter(isMIE);
            const AOs = node.successors('node').filter(isAO);
            highlightNodes = highlightNodes.union(MIEs).union(AOs);
          } else if (startType === 'AO') {
            const KEs = node.predecessors('node').filter(isKE);
            const MIEs = KEs.predecessors('node').filter(isMIE);
            highlightNodes = highlightNodes.union(KEs).union(MIEs);
          } else {
            const preds = node.predecessors('node').filter(n => isMIE(n) || isKE(n));
            const succs = node.successors('node').filter(n => isKE(n) || isAO(n));
            highlightNodes = highlightNodes.union(preds).union(succs);
          }

          const highlightEdges = highlightNodes.edgesWith(highlightNodes);

          cyLocal.batch(() => {
            highlightNodes.addClass('highlighted');
            highlightEdges.addClass('highlighted-edge');
            cyLocal.elements().difference(highlightNodes.union(highlightEdges)).addClass('faded');
          });

          // Fit view to highlighted chain
          cyLocal.animate({ fit: { eles: highlightNodes.union(highlightEdges), padding: 80 }, duration: 300 });
        } catch (e) {
          console.warn('Highlight chain failed:', e);
        }

        // Keep view centered on the primary selected node
        cy.center(node);
      }
    }

    if (selectedEdge) {
      const edge = cy.getElementById(selectedEdge.id);
      if (edge && edge.length > 0) {
        edge.addClass('selected');
      }
    }
  }, [selectedNode, selectedEdge, cy]);

  // Highlight the selected node chain
  useEffect(() => {
    if (!cy) return;
    // Clear previous chain classes
    cy.elements().removeClass('path-node path-edge');

    if (!selectedNodeChain || selectedNodeChain.length === 0) return;

    cy.batch(() => {
      // Mark chain nodes
      selectedNodeChain.forEach((id) => {
        const n = cy.getElementById(id);
        if (n && n.length > 0) {
          n.addClass('path-node');
        }
      });

      // Mark edges between consecutive nodes
      for (let i = 0; i < selectedNodeChain.length - 1; i++) {
        const a = selectedNodeChain[i];
        const b = selectedNodeChain[i + 1];
        const edge = cy.$(`edge[source = "${a}"][target = "${b}"], edge[source = "${b}"][target = "${a}"]`);
        if (edge && edge.length > 0) {
          edge.addClass('path-edge');
        }
      }
    });
  }, [selectedNodeChain, cy]);

  const handleZoomIn = () => {
    if (cy) {
      cy.zoom(cy.zoom() * 1.2);
      cy.center();
    }
  };

  const handleZoomOut = () => {
    if (cy) {
      cy.zoom(cy.zoom() * 0.8);
      cy.center();
    }
  };

  const handleReset = () => {
    if (cy) {
      cy.fit();
      cy.zoom(1);
    }
  };

  const handleExport = () => {
    exportAsPNG();
  };

  const handleCSVExport = () => {
    exportAsCSV();
  };

  const handleLayoutChange = (newLayout) => {
    setLayoutName(newLayout);
    if (cy) {
      const layout = cy.layout({
        name: newLayout,
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 50
      });
      layout.run();
    }
  };

  const layouts = [
    { name: 'cose-bilkent', label: 'Force Directed' },
    { name: 'grid', label: 'Grid' },
    { name: 'circle', label: 'Circle' },
    { name: 'concentric', label: 'Concentric' },
    { name: 'breadthfirst', label: 'Hierarchical' }
  ];

  return (
    <div className="relative w-full h-full">
      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background border border-border rounded-lg"
        style={{ minHeight: '500px' }}
      />
      
      {/* Controls */}
      <Card className="absolute top-4 left-4 p-2 bg-card/90 backdrop-blur-sm">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              title="Export PNG"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCSVExport}
              title="Export CSV"
            >
              📊
            </Button>
          </div>
          
          <select
            value={layoutName}
            onChange={(e) => handleLayoutChange(e.target.value)}
            className="text-xs p-1 border border-border rounded bg-background"
          >
            {layouts.map(layout => (
              <option key={layout.name} value={layout.name}>
                {layout.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Legend */}
      <Card className="absolute bottom-4 left-4 p-3 bg-card/90 backdrop-blur-sm">
        <h4 className="text-sm font-semibold mb-2">Node Types</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 border border-gray-400"
              style={{ 
                backgroundColor: nodeColors.MolecularInitiatingEvent,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
              }}
            />
            <span>MIE (Molecular Initiating Event)</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 border border-gray-400"
              style={{ backgroundColor: nodeColors.KeyEvent }}
            />
            <span>KE (Key Event)</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-gray-400"
              style={{ backgroundColor: nodeColors.AdverseOutcome }}
            />
            <span>AO (Adverse Outcome)</span>
          </div>
        </div>
      </Card>

      {/* Stats */}
      {data && (
        <Card className="absolute top-4 right-4 p-3 bg-card/90 backdrop-blur-sm">
          <div className="text-xs space-y-1">
            <div>Nodes: {data.nodes?.length || 0}</div>
            <div>Edges: {data.edges?.length || 0}</div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default NetworkGraph;

