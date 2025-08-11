import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

// Register the layout extension
cytoscape.use(coseBilkent);

const NetworkGraph = ({ data, onNodeSelect, selectedNode, theme = 'light' }) => {
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !data || !data.nodes || data.nodes.length === 0) {
      console.log('NetworkGraph: Missing container or data');
      return;
    }

    console.log('NetworkGraph: Creating cytoscape instance', data);

    // Destroy existing instance
    if (cy) {
      cy.destroy();
    }

    try {
      const elements = [
        ...(data.nodes?.map(node => ({
          group: 'nodes',
          data: { ...node }
        })) || []),
        ...(data.edges?.map(edge => ({
          group: 'edges',
          data: { ...edge, id: `${edge.source}-${edge.target}` }
        })) || [])
      ];

      const cytoscapeInstance = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (node) => {
                const type = node.data('type');
                if (type === 'MolecularInitiatingEvent') return '#10b981';
                if (type === 'AdverseOutcome') return '#ec4899';
                if (type === 'KeyEvent') return '#3b82f6';
                return '#6b7280';
              },
              'label': 'data(label)',
              'color': '#000',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px',
              'width': '60px',
              'height': '40px',
              'shape': (node) => {
                const type = node.data('type');
                if (type === 'MolecularInitiatingEvent') return 'triangle';
                if (type === 'AdverseOutcome') return 'diamond';
                return 'ellipse';
              },
              'text-wrap': 'wrap',
              'text-max-width': '55px'
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 3,
              'border-color': '#ff6b6b'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier'
            }
          }
        ],
        layout: {
          name: 'cose-bilkent',
          padding: 50,
          animate: true,
          animationDuration: 1000
        }
      });

      // Add click handler
      cytoscapeInstance.on('tap', 'node', (event) => {
        const node = event.target;
        const nodeData = node.data();
        console.log('Node clicked:', nodeData);
        if (onNodeSelect) {
          onNodeSelect(nodeData);
        }
      });

      setCy(cytoscapeInstance);
      console.log('NetworkGraph: Cytoscape instance created successfully');

      return () => {
        if (cytoscapeInstance) {
          cytoscapeInstance.destroy();
        }
      };

    } catch (error) {
      console.error('Error creating Cytoscape instance:', error);
    }
  }, [data, onNodeSelect]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div 
        ref={containerRef} 
        style={{ 
          height: '100%', 
          width: '100%',
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        }}
      />
      
      {/* Simple controls */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        gap: '8px',
        zIndex: 1000
      }}>
        <button 
          onClick={() => cy?.fit(cy.elements(), 50)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Fit
        </button>
        <button 
          onClick={() => cy?.zoom(cy.zoom() * 1.2)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Zoom +
        </button>
        <button 
          onClick={() => cy?.zoom(cy.zoom() * 0.8)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Zoom -
        </button>
      </div>

      {/* Info overlay */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        background: 'rgba(255,255,255,0.9)',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        Nodes: {data?.nodes?.length || 0} | Edges: {data?.edges?.length || 0}
      </div>
    </div>
  );
};

export default NetworkGraph;
