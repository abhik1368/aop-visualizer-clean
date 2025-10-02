import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import euler from 'cytoscape-euler';
import dagre from 'cytoscape-dagre';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, Download, Settings, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

// Register layout extensions
cytoscape.use(euler);
cytoscape.use(dagre);

const NetworkGraph = ({
  data,
  onNodeSelect,
  onEdgeSelect,
  selectedNode,
  selectedEdge,
  theme = 'light',
  onVisibleNodesChange,
  // Incremental/controls
  compactness = 60,
  onCompactnessChange,
  autoFitOnUpdate = true,
  onAutoFitToggle,
  selectedAopCount = 0,
  isLoading = false
}) => {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);
  const [layoutName, setLayoutName] = useState('force_atlas'); // Default to requested force atlas style
  const [controlsOpen, setControlsOpen] = useState(() => {
    try {
      return localStorage.getItem('networkControlsOpen') !== '0';
    } catch {
      return true;
    }
  });

  // Map compactness slider (0..100) to layout params - Optimized for compact rectangular layout
  const layoutParamsFromCompactness = (value) => {
    const t = Math.max(0, Math.min(100, value));
    const nodeRepulsion = 2500 - t * 15;   // Much lower repulsion for tight grouping
    const idealEdgeLength = 60 - t * 0.3;  // Shorter edges for compact layout
    const gravity = 0.25 + t * 0.01;       // Strong gravity to pull nodes together
    const nodeSeparation = 30 - t * 0.2;   // Minimal separation between nodes
    return { nodeRepulsion, idealEdgeLength, gravity, nodeSeparation };
  };

  // Lightweight post-layout collision resolver to reduce node overlap
  const resolveCollisions = (cyInst) => {
    if (!cyInst) return;
    const nodes = cyInst.nodes(':visible');
    if (nodes.length < 2) return;

    const iterations = 3; // few passes are enough for small adjustments
    cyInst.startBatch();
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      nodes.forEach((n1, i) => {
        const bb1 = n1.boundingBox({ includeLabels: true });
        const cx1 = (bb1.x1 + bb1.x2) / 2;
        const cy1 = (bb1.y1 + bb1.y2) / 2;
        nodes.forEach((n2, j) => {
          if (i >= j) return;
          const bb2 = n2.boundingBox({ includeLabels: true });
          const cx2 = (bb2.x1 + bb2.x2) / 2;
          const cy2 = (bb2.y1 + bb2.y2) / 2;

          const overlapX = Math.min(bb1.x2, bb2.x2) - Math.max(bb1.x1, bb2.x1);
          const overlapY = Math.min(bb1.y2, bb2.y2) - Math.max(bb1.y1, bb2.y1);
          if (overlapX > 0 && overlapY > 0) {
            // Push nodes apart along the dominant overlap axis
            const pushX = (cx1 < cx2 ? -1 : 1) * (overlapX + 2) * 0.5;
            const pushY = (cy1 < cy2 ? -1 : 1) * (overlapY + 2) * 0.5;

            const p1 = n1.position();
            const p2 = n2.position();
            n1.position({ x: p1.x + pushX, y: p1.y + pushY });
            n2.position({ x: p2.x - pushX, y: p2.y - pushY });
            moved = true;
          }
        });
      });
      if (!moved) break;
    }
    cyInst.endBatch();
  };

  // Incremental update of elements without full re-render
  const incrementalUpdate = (cyInst, nextData) => {
    if (!cyInst || !nextData) return;

    const existingNodeIds = new Set(cyInst.nodes().map(n => n.id()));
    const nextNodeIds = new Set((nextData.nodes || []).map(n => n.id));

    const existingEdgeIds = new Set(cyInst.edges().map(e => e.id()));
    const nextEdges = (nextData.edges || []).map(e => ({
      ...e,
      id: e.id || `${e.source}-${e.target}${e.relationship ? '-' + e.relationship : ''}`
    }));
    const nextEdgeIds = new Set(nextEdges.map(e => e.id));

    const nodesToAdd = (nextData.nodes || []).filter(n => !existingNodeIds.has(n.id));
    const nodesToRemove = Array.from(existingNodeIds).filter(id => !nextNodeIds.has(id));

    const edgesToAdd = nextEdges.filter(e => !existingEdgeIds.has(e.id));
    const edgesToRemove = Array.from(existingEdgeIds).filter(id => !nextEdgeIds.has(id));

    cyInst.startBatch();

    // Remove obsolete edges first then nodes
    if (edgesToRemove.length) {
      cyInst.remove(edgesToRemove.map(id => cyInst.getElementById(id)));
    }
    if (nodesToRemove.length) {
      cyInst.remove(nodesToRemove.map(id => cyInst.getElementById(id)));
    }

    // Update existing nodes metadata
    (nextData.nodes || []).forEach(n => {
      const ele = cyInst.getElementById(n.id);
      if (ele && ele.length) {
        ele.data({
          ...ele.data(),
          label: n.label || n.id,
          type: n.type || 'default',
          aop: n.aop || '',
          ontology: n.ontology || '',
          ontology_term: n.ontology_term || '',
          change: n.change || ''
        });
      }
    });

    // Add new nodes
    if (nodesToAdd.length) {
      cyInst.add(nodesToAdd.map(n => ({
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label || n.id,
          type: n.type || 'default',
          aop: n.aop || '',
          ontology: n.ontology || '',
          ontology_term: n.ontology_term || '',
          change: n.change || ''
        },
        classes: 'just-added'
      })));
    }

    // Add new edges
    if (edgesToAdd.length) {
      cyInst.add(edgesToAdd.map(e => ({
        group: 'edges',
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          relationship: e.relationship || '',
          confidence: e.confidence || '',
          evidence: e.evidence || '',
          adjacency: e.adjacency || ''
        },
        classes: 'just-added'
      })));
    }

    cyInst.endBatch();

    // Temporary highlight for new elements
    if (nodesToAdd.length || edgesToAdd.length) {
      setTimeout(() => {
        cyInst.nodes('.just-added').removeClass('just-added');
        cyInst.edges('.just-added').removeClass('just-added');
      }, 1500);
    }

    // Re-run layout according to compactness (defensive)
    try {
      const { nodeRepulsion, idealEdgeLength, gravity, nodeSeparation } = layoutParamsFromCompactness(compactness);
      
      // Use different layout configurations based on layout type
      let layoutConfig = {};
      
  if (layoutName === 'euler' || layoutName === 'force_atlas') {
    // Force-directed configuration with Euler
    layoutConfig = {
      name: 'euler',
      animate: false,
      fit: autoFitOnUpdate,
      padding: 20,
    randomize: false,
    springLength: Math.max(50, idealEdgeLength),
    springCoeff: 0.0008,
    repulsion: Math.max(2000, nodeRepulsion),
    gravity: Math.max(-2, gravity * -4),
    pull: 0.001,
    dragCoeff: 0.02,
    shear: 0.001,
    iterations: 2000,
    maxSimulationTime: 3000
        };
      } else {
        // Default configuration for other layouts
        layoutConfig = {
          name: layoutName,
          animate: true,
          fit: autoFitOnUpdate,
      padding: 30
        };
      }
      
    const layout = cyInst.layout(layoutConfig);
      layout.run();

      if (autoFitOnUpdate) {
        cyInst.fit(undefined, 30);
      }
    } catch (e) {
      console.warn('Incremental layout error:', e);
    }
  };

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

    // If we already have an instance, update incrementally and return
    if (cy) {
      incrementalUpdate(cy, data);
      return;
    }

    console.log('Initializing Cytoscape with nodes:', data.nodes?.length, 'edges:', data.edges?.length);

    // Apply performance limits for large datasets (defensive on undefined data)
    const maxNodes = 200; // Performance limit for network visualization
    const maxEdges = 400;

    const nodesArr = Array.isArray(data?.nodes) ? data.nodes : [];
    const edgesArr = Array.isArray(data?.edges) ? data.edges : [];

    const actualNodes = nodesArr.length > maxNodes ? nodesArr.slice(0, maxNodes) : nodesArr;
    const actualNodeIds = new Set(actualNodes.map(n => n.id));
    const filteredEdges = edgesArr.filter(edge =>
      edge && actualNodeIds.has(edge.source) && actualNodeIds.has(edge.target)
    );

    // Deduplicate edges by directional source=>target
    const edgeMap = new Map();
    filteredEdges.forEach(e => {
      if (!e || !e.source || !e.target) return;
      const key = `${e.source}=>${e.target}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, e);
      }
    });
    const dedupEdges = Array.from(edgeMap.values());
    const actualEdges = dedupEdges.slice(0, maxEdges);
    
    console.log(`NetworkGraph rendering: ${actualNodes.length} nodes (from ${data.nodes.length}), ${actualEdges.length} edges (from ${data.edges.length}, deduped from ${filteredEdges.length})`);
    
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
            aop: node.aop || node.aop_source || '',
            ontology: node.ontology || '',
            ontology_term: node.ontology_term || '',
            change: node.change || '',
            // Enhanced comprehensive search properties
            is_search_match: node.is_search_match || false,
            is_cross_pathway: node.is_cross_pathway || false,
            cross_pathway_count: node.cross_pathway_count || 0,
            aop_associations: node.aop_associations || [],
            matched_terms: node.matched_terms || []
          }
        })),
        ...actualEdges.map(edge => ({
          data: {
            id: edge.id || `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            relationship: edge.relationship || '',
            confidence: edge.confidence || '',
            evidence: edge.evidence || '',
            adjacency: edge.adjacency || '',
            // Enhanced comprehensive search properties
            is_cross_pathway: edge.is_cross_pathway || false,
            aop_source: edge.aop_source || edge.aop || '',
            source_aop_count: edge.source_aop_count || 0,
            target_aop_count: edge.target_aop_count || 0
          }
        }))
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => {
              const nodeType = ele.data('type');
              const isSearchMatch = ele.data('is_search_match');
              const isCrossPathway = ele.data('is_cross_pathway');
              
              if (isSearchMatch) {
                // Highlight search matches with brighter colors like target image
                switch (nodeType) {
                  case 'MolecularInitiatingEvent': return '#16a34a'; // bright green
                  case 'KeyEvent': return '#2563eb'; // bright blue
                  case 'AdverseOutcome': return '#dc2626'; // bright red/orange
                  default: return '#6b7280'; // bright gray
                }
              } else if (isCrossPathway) {
                // Cross-pathway nodes get gradient-like effect
                switch (nodeType) {
                  case 'MolecularInitiatingEvent': return '#22c55e'; // tinted green
                  case 'KeyEvent': return '#3b82f6'; // tinted blue
                  case 'AdverseOutcome': return '#f97316'; // tinted orange
                  default: return '#9ca3af'; // tinted gray
                }
              }
              
              // Default colors matching target image
              switch (nodeType) {
                case 'MolecularInitiatingEvent': return '#6ee7b7'; // richer green
                case 'KeyEvent': return '#60a5fa'; // richer blue
                case 'AdverseOutcome': return '#f472b6'; // richer pink
                default: return '#d1d5db'; // light gray
              }
            },
            'background-opacity': 1,
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#1f2937',
            'text-outline-color': '#ffffff',
            'text-outline-width': 0,
            'font-size': '9px', // Smaller, consistent font size
            'font-family': 'Arial, sans-serif',
            'font-weight': (ele) => {
              const isSearchMatch = ele.data('is_search_match');
              return isSearchMatch ? 'bold' : 'normal';
            },
            'width': (ele) => {
              const label = ele.data('label') || '';
              const isSearchMatch = ele.data('is_search_match');
              const type = ele.data('type') || '';
              
              // Special sizing for hypernodes - much smaller
              if (type.includes('hypernode') || type.includes('chemical-hypernode')) {
                return Math.max(60, Math.min(120, label.length * 1.5 + 30)); // Smaller hypernodes
              }
              
              // Standard node sizing. For MIE/KE/AO enforce equal width/height (square/circle/triangle)
              const compactSize = Math.max(40, Math.min(70, label.length * 1.5 + 30));
              const baseSize = Math.max(45, Math.min(85, label.length * 2 + 30));
              const size = (type === 'MolecularInitiatingEvent' || type === 'MIE' ||
                             type === 'KeyEvent' || type === 'KE' ||
                             type === 'AdverseOutcome' || type === 'AO') ? compactSize : baseSize;
              return isSearchMatch ? size * 1.1 : size;
            },
            'height': (ele) => {
              const isSearchMatch = ele.data('is_search_match');
              const type = ele.data('type') || '';
              const label = ele.data('label') || '';
              
              // Special sizing for hypernodes - much smaller
              if (type.includes('hypernode') || type.includes('chemical-hypernode')) {
                return 28; // Much smaller height for hypernodes
              }
              
              // Enforce equal dimensions for MIE (triangle), KE (square), AO (circle)
              if (type === 'MolecularInitiatingEvent' || type === 'MIE' ||
                  type === 'KeyEvent' || type === 'KE' ||
                  type === 'AdverseOutcome' || type === 'AO') {
                const size = Math.max(40, Math.min(70, label.length * 1.5 + 30));
                return isSearchMatch ? size * 1.1 : size;
              }
              
              // Default rectangular height for other types
              const baseSize = 36;
              return isSearchMatch ? baseSize * 1.1 : baseSize;
            },
            'shape': (ele) => {
              const nodeType = ele.data('type');
              if (nodeType === 'MolecularInitiatingEvent' || nodeType === 'MIE') return 'triangle';
              if (nodeType === 'KeyEvent' || nodeType === 'KE') return 'rectangle';
              if (nodeType === 'AdverseOutcome' || nodeType === 'AO') return 'ellipse';
              return 'roundrectangle';
            },
            'border-width': (ele) => {
              const isSearchMatch = ele.data('is_search_match');
              const isCrossPathway = ele.data('is_cross_pathway');
              if (isSearchMatch) return 3;
              if (isCrossPathway) return 2;
              return 2;
            },
            'border-color': (ele) => {
              const isSearchMatch = ele.data('is_search_match');
              const isCrossPathway = ele.data('is_cross_pathway');
              if (isSearchMatch) return '#f59e0b'; // golden border for search matches
              if (isCrossPathway) return '#8b5cf6'; // purple border for cross-pathway
              return '#1f2937';
            },
            'text-wrap': 'wrap',
            'text-max-width': '110px' // Slightly narrower to match reduced sizes
          }
        },
        {
          // Special styling for search match nodes
          selector: 'node[is_search_match]',
          style: {
            'overlay-opacity': 0
          }
        },
        {
          // Special styling for cross-pathway nodes
          selector: 'node[is_cross_pathway]',
          style: {
            'overlay-opacity': 0
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
            'width': (ele) => {
              const isCrossPathway = ele.data('is_cross_pathway');
              const confidence = ele.data('confidence');
              let baseWidth = 2;
              
              // Thicker for cross-pathway edges
              if (isCrossPathway) baseWidth = 3;
              
              // Adjust by confidence level
              if (confidence === '3') baseWidth += 0.5; // High confidence
              else if (confidence === '1') baseWidth -= 0.5; // Low confidence
              
              return Math.max(1, baseWidth);
            },
            'line-color': (ele) => {
              const isCrossPathway = ele.data('is_cross_pathway');
              const confidence = ele.data('confidence');
              
              if (isCrossPathway) {
                return '#8b5cf6'; // Purple for cross-pathway edges
              }
              
              // Color by confidence
              if (confidence === '3') return '#10b981'; // Green for high confidence
              else if (confidence === '2') return theme === 'dark' ? '#64748b' : '#374151'; // Default
              else if (confidence === '1') return '#f59e0b'; // Orange for low confidence
              
              return theme === 'dark' ? '#64748b' : '#374151';
            },
            'target-arrow-color': (ele) => {
              const isCrossPathway = ele.data('is_cross_pathway');
              const confidence = ele.data('confidence');
              
              if (isCrossPathway) return '#8b5cf6';
              if (confidence === '3') return '#10b981';
              else if (confidence === '1') return '#f59e0b';
              
              return theme === 'dark' ? '#64748b' : '#374151';
            },
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2,
            'line-style': (ele) => {
              const isCrossPathway = ele.data('is_cross_pathway');
              return isCrossPathway ? 'dashed' : 'solid'; // Dashed for cross-pathway
            },
            'label': (ele) => {
              const rel = ele.data('relationship');
              const isCrossPathway = ele.data('is_cross_pathway');
              if (isCrossPathway && rel) {
                return `🔗 ${rel.substring(0, 15)}`;
              }
              return rel ? rel.substring(0, 20) : '';
            },
            'font-size': '10px',
            'color': theme === 'dark' ? '#ffffff' : '#000000',
            'text-background-opacity': 0
          }
        },
        {
          selector: 'edge.just-added',
          style: {
            'width': 3,
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#ff6b35',
            'target-arrow-color': '#ff6b35'
          }
        }
      ],
      layout: (['force_atlas', 'euler'].includes(layoutName) ? {
        name: 'euler',
        animate: true,
        animationDuration: 700,
        fit: true,
        padding: 40,
        nodeDimensionsIncludeLabels: true,
        randomize: false,
        springLength: 90,
        springCoeff: 0.0006,
        repulsion: 9000,
        gravity: -0.7,
        iterations: 1800
      } : {
        name: layoutName,
        animate: true,
        animationDuration: 600,
        fit: true,
        padding: 40
      }),
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    // Event handlers (defensive)
    cytoscapeInstance.on('layoutstop', () => {
      try {
        resolveCollisions(cytoscapeInstance);
        cytoscapeInstance.fit();
        cytoscapeInstance.center();
      } catch (err) {
        console.warn('Collision resolution error:', err);
      }
    });
    cytoscapeInstance.on('tap', 'node', (evt) => {
      try {
        const node = evt.target;
        if (!node) return;
        const nodeData = {
          id: node.data('id'),
          label: node.data('label'),
          type: node.data('type'),
          aop: node.data('aop'),
          ontology: node.data('ontology'),
          ontology_term: node.data('ontology_term'),
          change: node.data('change')
        };
        // Pass full node object only once
        onNodeSelect && onNodeSelect(nodeData);
      } catch (e) {
        console.warn('Node tap handler error:', e);
      }
    });

    cytoscapeInstance.on('tap', 'edge', (evt) => {
      try {
        const edge = evt.target;
        if (!edge) return;
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
      } catch (e) {
        console.warn('Edge tap handler error:', e);
      }
    });

    cytoscapeInstance.on('tap', (evt) => {
      if (evt.target === cytoscapeInstance) {
        // Clicked on background
        onNodeSelect && onNodeSelect(null);
        onEdgeSelect && onEdgeSelect(null);
      }
    });

  // Apply force-directed layout with strong non-overlap for compact organization
    const applyNonOverlappingLayout = () => {
      const allNodes = cytoscapeInstance.nodes();
      const hyperNodes = allNodes.filter(node => {
        const nodeType = node.data('type') || '';
        return nodeType.includes('hypernode') || nodeType.includes('chemical-hypernode');
      });

      const layout = cytoscapeInstance.layout({
        name: layoutName === 'force_atlas' ? 'euler' : layoutName,
        animate: true,
        animationDuration: 700,
        fit: true,
        padding: 40,
        randomize: false,
        springLength: 95,
        springCoeff: 0.0006,
        repulsion: 9000,
        gravity: -0.7,
        iterations: 1800
      });

      layout.run();

      // Additional hypernode positioning for clean separation
      setTimeout(() => {
        if (hyperNodes.length > 0) {
          // Apply additional spacing for hypernodes after main layout
          const hyperLayout = hyperNodes.layout({
            name: 'grid',
            animate: true,
            animationDuration: 800,
            fit: false,
            rows: Math.ceil(Math.sqrt(hyperNodes.length)),
            cols: Math.ceil(Math.sqrt(hyperNodes.length)),
            spacingFactor: 3.5, // Very large spacing for hypernodes
            avoidOverlap: true,
            avoidOverlapPadding: 100,
            boundingBox: {
              x1: cytoscapeInstance.width() * 0.7, // Position hypernodes on right side
              y1: 50,
              x2: cytoscapeInstance.width() - 50,
              y2: cytoscapeInstance.height() - 50
            }
          });
          hyperLayout.run();
        }
      }, 1200);
    };

    // Enhanced function to position nested chemical nodes within hypernode containers with guaranteed no overlap
    const applyNestedNodePositioning = () => {
      console.log('🏗️ Applying enhanced nested node positioning for chemical nodes');
      
      const allNodes = cytoscapeInstance.nodes();
      
      // Find nodes that have parent property (nested chemical nodes)
      const nestedNodes = allNodes.filter(node => {
        const data = node.data();
        return data.parent && data.parent !== '';
      });
      
      if (nestedNodes.length === 0) {
        console.log('No nested nodes found to position');
        return;
      }
      
      console.log(`Found ${nestedNodes.length} nested chemical nodes to position`);
      
      // Group nested nodes by their parent
      const nodesByParent = {};
      nestedNodes.forEach(node => {
        const parentId = node.data().parent;
        if (!nodesByParent[parentId]) {
          nodesByParent[parentId] = [];
        }
        nodesByParent[parentId].push(node);
      });
      
      console.log(`Grouped nodes under ${Object.keys(nodesByParent).length} parent hypernodes`);
      
      // Position each group of nested nodes with GUARANTEED no overlap
      Object.entries(nodesByParent).forEach(([parentId, children]) => {
        const parentNode = cytoscapeInstance.getElementById(parentId);
        if (!parentNode.length) {
          console.warn(`Parent hypernode ${parentId} not found`);
          return;
        }
        
        const parentPos = parentNode.position();
        const parentBB = parentNode.boundingBox();
        const parentWidth = Math.max(parentBB.w || 200, 300); // Ensure minimum parent size
        const parentHeight = Math.max(parentBB.h || 150, 200); // Ensure minimum parent size
        
        console.log(`Positioning ${children.length} children within parent ${parentId} (${parentWidth}x${parentHeight})`);
        
        // Calculate optimal grid layout to prevent overlap
        const childCount = children.length;
        
        // Estimate child node size (conservative estimate)
        const childNodeWidth = 80;  // Conservative estimate for chemical node width
        const childNodeHeight = 40; // Conservative estimate for chemical node height
        
        // Calculate minimum spacing needed (node size + buffer)
        const minSpacingX = childNodeWidth + 30;  // Node width + 30px buffer
        const minSpacingY = childNodeHeight + 25; // Node height + 25px buffer
        
        // Determine grid dimensions that will fit within parent with proper spacing
        let cols = Math.ceil(Math.sqrt(childCount));
        let rows = Math.ceil(childCount / cols);
        
        // Ensure grid fits within parent bounds with adequate spacing
        const requiredWidth = (cols - 1) * minSpacingX;
        const requiredHeight = (rows - 1) * minSpacingY;
        const availableWidth = parentWidth * 0.9;  // Use 90% of parent width
        const availableHeight = parentHeight * 0.8; // Use 80% of parent height
        
        // Adjust grid if it doesn't fit
        while (requiredWidth > availableWidth && cols > 1) {
          cols = cols - 1;
          rows = Math.ceil(childCount / cols);
        }
        
        // Recalculate final spacing with adjusted grid
        const actualSpacingX = Math.max(minSpacingX, availableWidth / Math.max(1, cols - 1));
        const actualSpacingY = Math.max(minSpacingY, availableHeight / Math.max(1, rows - 1));
        
        console.log(`Grid: ${cols}x${rows}, Spacing: ${actualSpacingX}x${actualSpacingY}, Available: ${availableWidth}x${availableHeight}`);
        
        // Position children with guaranteed spacing
        children.forEach((child, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          // Calculate absolute position to guarantee no overlap
          const offsetX = (col - (cols - 1) / 2) * actualSpacingX;
          const offsetY = (row - (rows - 1) / 2) * actualSpacingY;
          
          const childX = parentPos.x + offsetX;
          const childY = parentPos.y + offsetY;
          
          console.log(`🧸 Positioning child ${child.id()}: (${childX}, ${childY}) grid[${row},${col}] spacing[${actualSpacingX},${actualSpacingY}]`);
          
          // Use immediate positioning instead of animation to prevent layout conflicts
          child.position({ x: childX, y: childY });
          
          // Optional: Add a small delay for visual effect
          setTimeout(() => {
            child.animate({
              position: { x: childX, y: childY }
            }, {
              duration: 400,
              easing: 'ease-out-quart'
            });
          }, index * 50); // Stagger animations
        });
      });
      
      console.log('✅ Enhanced nested positioning complete - guaranteed no overlaps');
    };

    // Apply the guaranteed non-overlapping layout
    // Only apply the extra force/non-overlap passes for force layouts
    setTimeout(() => {
      if (['force_atlas', 'euler'].includes(layoutName)) {
        applyNonOverlappingLayout();
        // Apply nested positioning after main layout settles
        setTimeout(() => {
          applyNestedNodePositioning();
        }, 1500);
      }
    }, 100);

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

  // Update selection highlighting
  useEffect(() => {
    if (!cy) return;

    // Clear previous selections
    cy.elements().removeClass('selected');

    if (selectedNode && selectedNode.id) {
      try {
        const node = cy.getElementById(selectedNode.id);
        if (node && node.length > 0) {
          node.addClass('selected');
          // Guard against invalid centers
          cy.center(node);
        }
      } catch (e) {
        console.warn('Selection highlight error:', e);
      }
    }

    if (selectedEdge) {
      const edge = cy.getElementById(selectedEdge.id);
      if (edge.length > 0) {
        edge.addClass('selected');
      }
    }
  }, [selectedNode, selectedEdge, cy]);

  // Dynamic layout updates for compactness changes - prevents graph refresh
  useEffect(() => {
    if (!cy) return;
    
    const updateDynamicLayout = () => {
      const allNodes = cy.nodes();
      const hyperNodes = allNodes.filter(node => {
        const nodeType = node.data('type') || '';
        return nodeType.includes('hypernode') || nodeType.includes('chemical-hypernode');
      });
      const regularNodes = allNodes.filter(node => {
        const nodeType = node.data('type') || '';
        return !nodeType.includes('hypernode') && !nodeType.includes('chemical-hypernode');
      });
      
      // Calculate optimal grid layout for ALL nodes to prevent overlap
      const totalNodes = allNodes.length;
      const gridCols = Math.ceil(Math.sqrt(totalNodes * 1.4)); // Optimized grid ratio
      const gridRows = Math.ceil(totalNodes / gridCols);
      
      // Dynamic spacing based on compactness (inverse relationship)
      const baseSpacing = 140 - compactness; // Range: 40-140px
      const nodeSpacing = Math.max(60, baseSpacing);
      
      // Apply optimized grid layout to ALL nodes to guarantee no overlaps
      let nodeIndex = 0;
      
      // First position regular nodes in a tight grid
      regularNodes.forEach((node, index) => {
        const row = Math.floor(nodeIndex / gridCols);
        const col = nodeIndex % gridCols;
        
        const x = col * nodeSpacing + 80;
        const y = row * nodeSpacing + 80;
        
        node.animate({
          position: { x, y }
        }, {
          duration: 500,
          easing: 'ease-in-out-quad'
        });
        
        nodeIndex++;
      });
      
      // GUARANTEED non-overlapping hypernode grid with massive spacing
      if (hyperNodes.length > 0) {
        const hyperCols = Math.max(2, Math.ceil(Math.sqrt(hyperNodes.length))); // Min 2 cols
        const hyperRows = Math.ceil(hyperNodes.length / hyperCols);
        
        // MASSIVE spacing to absolutely prevent overlap - account for hypernode size
        const minHypernodeSize = 200; // Assume max hypernode width/height
        const safetyBuffer = 100; // Extra buffer between hypernodes
        const hyperSpacing = minHypernodeSize + safetyBuffer; // 300px minimum spacing
        
        // Position hypernodes in completely separate area
        const hyperStartX = (gridCols * nodeSpacing) + 200; // Large buffer from regular nodes
        const hyperStartY = 100;
        
        setTimeout(() => {
          hyperNodes.forEach((hyperNode, index) => {
            const row = Math.floor(index / hyperCols);
            const col = index % hyperCols;
            
            // Calculate absolute grid position with guaranteed spacing
            const x = hyperStartX + (col * hyperSpacing);
            const y = hyperStartY + (row * hyperSpacing);
            
            hyperNode.animate({
              position: { x, y }
            }, {
              duration: 700,
              easing: 'ease-out-quart'
            });
            
            // Debug log to verify positioning
            console.log(`Hypernode ${index}: positioned at (${x}, ${y}), spacing: ${hyperSpacing}`);
          });
        }, 300);
      }
      
      // Fit view after all animations and apply nested positioning
      setTimeout(() => {
        cy.fit(undefined, 40);
        
        // Apply enhanced nested node positioning for chemical nodes within hypernodes
        const nestedNodes = cy.nodes().filter(node => {
          const data = node.data();
          return data.parent && data.parent !== '';
        });
        
        if (nestedNodes.length > 0) {
          console.log(`🔄 Updating ${nestedNodes.length} nested chemical node positions with enhanced spacing`);
          
          // Group by parent and reposition
          const nodesByParent = {};
          nestedNodes.forEach(node => {
            const parentId = node.data().parent;
            if (!nodesByParent[parentId]) {
              nodesByParent[parentId] = [];
            }
            nodesByParent[parentId].push(node);
          });
          
          Object.entries(nodesByParent).forEach(([parentId, children]) => {
            const parentNode = cy.getElementById(parentId);
            if (!parentNode.length) return;
            
            const parentPos = parentNode.position();
            const parentBB = parentNode.boundingBox();
            const parentWidth = Math.max(parentBB.w || 200, 300); // Ensure minimum parent size
            const parentHeight = Math.max(parentBB.h || 150, 200); // Ensure minimum parent size
            
            const childCount = children.length;
            
            // Conservative child node size estimates
            const childNodeWidth = 80;
            const childNodeHeight = 40;
            
            // Base spacing that responds to compactness slider
            const compactnessMultiplier = Math.max(0.7, 1 - (compactness * 0.005)); // Less aggressive compactness effect
            const baseSpacingX = (childNodeWidth + 30) * compactnessMultiplier; // Node width + buffer, adjusted for compactness
            const baseSpacingY = (childNodeHeight + 25) * compactnessMultiplier; // Node height + buffer, adjusted for compactness
            
            // Ensure minimum spacing regardless of compactness
            const minSpacingX = Math.max(baseSpacingX, childNodeWidth + 20); // Always at least node width + 20px
            const minSpacingY = Math.max(baseSpacingY, childNodeHeight + 15); // Always at least node height + 15px
            
            // Calculate optimal grid
            let cols = Math.ceil(Math.sqrt(childCount));
            let rows = Math.ceil(childCount / cols);
            
            // Check if grid fits within parent bounds
            const requiredWidth = (cols - 1) * minSpacingX;
            const requiredHeight = (rows - 1) * minSpacingY;
            const availableWidth = parentWidth * 0.9;
            const availableHeight = parentHeight * 0.8;
            
            // Adjust grid if needed
            while (requiredWidth > availableWidth && cols > 1) {
              cols = cols - 1;
              rows = Math.ceil(childCount / cols);
            }
            
            // Final spacing calculation
            const actualSpacingX = Math.max(minSpacingX, availableWidth / Math.max(1, cols - 1));
            const actualSpacingY = Math.max(minSpacingY, availableHeight / Math.max(1, rows - 1));
            
            console.log(`🔄 Dynamic update - Grid: ${cols}x${rows}, Spacing: ${actualSpacingX.toFixed(1)}x${actualSpacingY.toFixed(1)}, Compactness: ${compactness}`);
            
            children.forEach((child, index) => {
              const col = index % cols;
              const row = Math.floor(index / cols);
              
              const offsetX = (col - (cols - 1) / 2) * actualSpacingX;
              const offsetY = (row - (rows - 1) / 2) * actualSpacingY;
              
              const childX = parentPos.x + offsetX;
              const childY = parentPos.y + offsetY;
              
              child.animate({
                position: { x: childX, y: childY }
              }, {
                duration: 400,
                easing: 'ease-in-out-quad'
              });
            });
          });
        }
      }, 800);
    };

    // Debounce updates to prevent excessive re-layouts
    const timeoutId = setTimeout(updateDynamicLayout, 150);
    return () => clearTimeout(timeoutId);
  }, [compactness, cy]); // Re-run when compactness changes

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
      try {
        // Use tailored options for force vs. non-force layouts
        const isForce = ['force_atlas', 'euler'].includes(newLayout);
        const layout = cy.layout(isForce ? {
          name: 'euler',
          animate: true,
          animationDuration: 700,
          fit: true,
          padding: 50,
          randomize: false,
          springLength: 95,
          springCoeff: 0.0006,
          repulsion: 9000,
          gravity: -0.7,
          iterations: 1800
        } : {
          name: newLayout,
          animate: true,
          animationDuration: 600,
          fit: true,
          padding: 50
        });
        layout.run();
        cy.fit(undefined, 50);
        cy.center();
      } catch (err) {
        console.warn('Layout change failed, falling back to grid:', err);
        const fallback = cy.layout({ name: 'grid', fit: true, padding: 50 });
        fallback.run();
        cy.fit(undefined, 50);
        cy.center();
      }
    }
  };

    const layouts = [
      { name: 'force_atlas', label: 'Force Atlas (Euler)' }
    ];

  return (
    <div className="relative w-full h-full">
      {/* Graph Container */}
      <div
        ref={containerRef}
        className="w-full h-full bg-background border border-border rounded-lg"
        style={{ minHeight: '500px' }}
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-sm text-muted-foreground font-medium">
              Loading AOP Network...
            </div>
          </div>
        </div>
      )}
      
      {/* Controls (collapsible) */}
      <Card className="absolute top-4 left-4 p-2 bg-card/90 backdrop-blur-sm">
        <Collapsible
          open={controlsOpen}
          onOpenChange={(open) => {
            setControlsOpen(open);
            try {
              localStorage.setItem('networkControlsOpen', open ? '1' : '0');
            } catch {}
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Controls</div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title={controlsOpen ? 'Collapse' : 'Expand'}>
                <ChevronDown className={`h-4 w-4 transition-transform ${controlsOpen ? '' : '-rotate-90'}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-2">
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
                  title="Fit to View"
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

              {/* Compactness control */}
              <div className="mt-1">
                <div className="text-[10px] text-muted-foreground mb-1">Compactness</div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={compactness}
                  onChange={(e) => onCompactnessChange && onCompactnessChange(parseInt(e.target.value))}
                  className="w-40"
                />
              </div>

              {/* Auto-fit toggle */}
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={autoFitOnUpdate}
                  onChange={(e) => onAutoFitToggle && onAutoFitToggle(e.target.checked)}
                />
                Auto-fit on update
              </label>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Legend removed per user request */}

      {/* Stats */}
      {data && (
        <Card className="absolute top-4 right-4 p-3 bg-card/90 backdrop-blur-sm">
          <div className="text-xs space-y-1">
            <div>Selected AOPs: {selectedAopCount}</div>
            <div>Nodes: {data.nodes?.length || 0}</div>
            <div>Edges: {data.edges?.length || 0}</div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default NetworkGraph;

