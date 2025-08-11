import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(fcose);
cytoscape.use(coseBilkent);

// Simplified hypergraph component that shows individual colored circular nodes
const HypergraphNetworkGraph = ({ 
  data, 
  hypergraphData = null,
  onNodeSelect, 
  onEdgeSelect, 
  selectedNode, 
  selectedEdge,
  theme = 'light',
  hypergraphEnabled = false,
  minNodes = 2,
  layoutType = 'fcose',
  communityData = null
}) => {
  // State for node size and font size controls
  const [nodeSize, setNodeSize] = useState(35);
  const [fontSize, setFontSize] = useState(9);
  
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);
  const [hyperElementCounts, setHyperElementCounts] = useState({ hypernodes: 0, hyperedges: 0 });

  // Safety check - prevent crashes with missing data
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 mb-2">No graph data available</div>
          <div className="text-sm text-gray-400">Select an AOP to view the network</div>
          {data && <div className="text-xs text-gray-300 mt-2">Nodes: {data.nodes?.length || 0}</div>}
        </div>
      </div>
    );
  }

  // Ensure we have nodes and edges, even if empty arrays
  const safeData = {
    nodes: data.nodes || [],
    edges: data.edges || []
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Destroy existing instance if it exists
    if (cy) {
      cy.removeAllListeners();
      cy.destroy();
      setCy(null);
    }
    
    console.log('HypergraphNetworkGraph: Initializing cytoscape with', 
      safeData.nodes.length, 'nodes', 
      hypergraphEnabled ? '(hypergraph mode)' : ''
    );

    try {
      // Prepare nodes - all as individual colored circles
      const nodes = safeData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label || node.id,
          type: node.type,
          isHyper: false
        },
        classes: `base-node node-${node.type?.toLowerCase() || 'other'}`
      }));
      
      // Prepare edges
      const edges = safeData.edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'regular',
          isHyper: false
        },
        classes: 'base-edge'
      }));

      // Update counts
      setHyperElementCounts({ 
        hypernodes: 0, 
        hyperedges: 0 
      });

      console.log('Creating cytoscape with elements:', {
        nodes: nodes.length,
        edges: edges.length
      });

      // If we have no elements to render, show a message
      if (nodes.length === 0) {
        console.warn('No nodes to render!');
        return;
      }

      const cytoscapeInstance = cytoscape({
        container: containerRef.current,
        elements: [
          ...nodes,
          ...edges
        ],
        style: [
          // Individual node styling - colored circles
          {
            selector: 'node',
            style: {
              'width': nodeSize,
              'height': nodeSize,
              'background-color': (node) => {
                const type = node.data('type');
                // Light pastel colors
                if (type === 'MolecularInitiatingEvent' || type === 'MIE') return '#86efac'; // Light green
                if (type === 'KeyEvent' || type === 'KE') return '#93c5fd';  // Light blue
                if (type === 'AdverseOutcome' || type === 'AO') return '#f9a8d4';  // Light pink
                return '#d1d5db'; // Light gray for others
              },
              'border-width': 2,
              'border-color': '#ffffff',
              'shape': 'ellipse', // All nodes as circles
              'label': 'data(label)',
              'font-size': `${fontSize}px`,
              'font-weight': 'bold',
              'color': '#1f2937',
              'text-valign': 'center',
              'text-halign': 'center',
              'text-outline-width': 1,
              'text-outline-color': '#ffffff',
              'text-max-width': '80px',
              'text-wrap': 'wrap',
              'z-index': 10
            }
          },
          // Edge styling
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#374151',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#374151',
              'arrow-scale': 0.8,
              'opacity': 0.8,
              'z-index': 5
            }
          },
          // Selected node styling
          {
            selector: '.selected',
            style: {
              'border-width': 4,
              'border-color': '#ef4444',
              'z-index': 20
            }
          }
        ],
        layout: {
          name: layoutType,
          animate: true,
          animationDuration: 1000,
          fit: true,
          padding: 50,
          // fcose specific options
          quality: 'default',
          randomize: false,
          animate: 'end',
          animationEasing: 'ease-out',
          animationDuration: 1000,
          fit: true,
          padding: 50,
          nodeDimensionsIncludeLabels: true,
          uniformNodeDimensions: false,
          packComponents: true,
          nodeRepulsion: 4500,
          idealEdgeLength: 50,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          numIter: 2500,
          tile: true,
          tilingPaddingVertical: 10,
          tilingPaddingHorizontal: 10
        }
      });

      // Add event listeners
      cytoscapeInstance.on('tap', 'node', (evt) => {
        const node = evt.target;
        console.log('Node clicked:', node.data());
        if (onNodeSelect) {
          onNodeSelect(node.data());
        }
      });

      cytoscapeInstance.on('tap', 'edge', (evt) => {
        const edge = evt.target;
        console.log('Edge clicked:', edge.data());
        if (onEdgeSelect) {
          onEdgeSelect(edge.data());
        }
      });

      cytoscapeInstance.on('tap', (evt) => {
        if (evt.target === cytoscapeInstance) {
          // Clicked on background
          onNodeSelect && onNodeSelect(null);
          onEdgeSelect && onEdgeSelect(null);
        }
      });

      setCy(cytoscapeInstance);
      cyRef.current = cytoscapeInstance;

      console.log('HypergraphNetworkGraph: Cytoscape initialized successfully');
      console.log('Elements in graph:', cytoscapeInstance.elements().length);
      console.log('Nodes in graph:', cytoscapeInstance.nodes().length);
      console.log('Edges in graph:', cytoscapeInstance.edges().length);

      // Force a fit to ensure elements are visible
      setTimeout(() => {
        if (cytoscapeInstance) {
          cytoscapeInstance.fit();
          cytoscapeInstance.center();
        }
      }, 100);

      return () => {
        if (cytoscapeInstance) {
          cytoscapeInstance.removeAllListeners();
          cytoscapeInstance.destroy();
        }
      };
    } catch (error) {
      console.error('HypergraphNetworkGraph: Error initializing cytoscape:', error);
    }
  }, [data, hypergraphData, onNodeSelect, onEdgeSelect, layoutType, hypergraphEnabled, minNodes]);

  // Update selection highlighting
  useEffect(() => {
    if (!cy) return;

    // Clear previous selections
    cy.elements().removeClass('selected');

    if (selectedNode) {
      const node = cy.getElementById(selectedNode.id);
      if (node.length > 0) {
        node.addClass('selected');
      }
    }

    if (selectedEdge) {
      const edge = cy.getElementById(selectedEdge.id);
      if (edge.length > 0) {
        edge.addClass('selected');
      }
    }
  }, [cy, selectedNode, selectedEdge]);

  // Update node and font sizes dynamically
  useEffect(() => {
    if (!cy) return;

    cy.startBatch();
    cy.nodes().forEach(node => {
      node.style({
        'width': nodeSize,
        'height': nodeSize,
        'font-size': `${fontSize}px`
      });
    });
    cy.endBatch();

  }, [cy, nodeSize, fontSize]);

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      <div className="absolute top-2 left-2 z-20 bg-white p-2 rounded-lg shadow-md">
        <div className="flex flex-col space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700">Node Size: {nodeSize}</label>
            <input
              type="range"
              min="10"
              max="100"
              value={nodeSize}
              onChange={(e) => setNodeSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Font Size: {fontSize}</label>
            <input
              type="range"
              min="5"
              max="25"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
      
      {/* Subtle background pattern for visual depth */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.15)_1px,transparent_0)] bg-[length:20px_20px]"></div>
      </div>
      
      <div 
        ref={containerRef} 
        className="relative z-10 w-full h-full rounded-lg shadow-inner"
        style={{ 
          minHeight: '400px',
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />
      
    </div>
  );
};

export default HypergraphNetworkGraph;
