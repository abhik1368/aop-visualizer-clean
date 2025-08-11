import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

// Register the layout extension
cytoscape.use(coseBilkent);

const NetworkGraph = ({ data, onNodeSelect, selectedNode, theme = 'light', nodeSize = 20, fontSize = 8 }) => {
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);
  const [layoutName, setLayoutName] = useState('cose-bilkent');
  const [hypergraph, setHypergraph] = useState('community-detection');

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
              'font-size': `${fontSize}px`,
              'width': `${nodeSize}px`,
              'height': `${nodeSize}px`,
              'shape': (node) => {
                const type = node.data('type');
                if (type === 'MolecularInitiatingEvent') return 'triangle';
                if (type === 'AdverseOutcome') return 'diamond';
                return 'ellipse';
              },
              'text-wrap': 'wrap',
              'text-max-width': `${nodeSize + 10}px`,
              'border-width': 2,
              'border-color': '#fff',
              'border-opacity': 0.8
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
          name: layoutName,
          padding: 50,
          animate: true,
          animationDuration: 1000,
          // Additional layout options for better spacing
          idealEdgeLength: 80,
          nodeOverlap: 20,
          refresh: 20,
          fit: true,
          randomize: false
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
  }, [data, onNodeSelect, layoutName, nodeSize, fontSize]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Graph container */}
      <div 
        ref={containerRef} 
        style={{ 
          height: '100%', 
          width: '100%',
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        }}
      />

      {/* Controls Panel */}
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '15px', 
        background: 'white', 
        padding: '12px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
        zIndex: 1000,
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button 
            onClick={() => cy?.fit(cy.elements(), 50)}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Fit to view"
          >🔍</button>
          <button 
            onClick={() => cy?.zoom(cy.zoom() * 1.2)}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Zoom in"
          >➕</button>
          <button 
            onClick={() => cy?.zoom(cy.zoom() * 0.8)}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Zoom out"
          >➖</button>
          <button 
            onClick={() => console.log('undo')}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Undo"
          >↩️</button>
          <button 
            onClick={() => console.log('download')}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Download"
          >⬇️</button>
          <button 
            onClick={() => console.log('chart')}
            style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
            title="Chart view"
          >📊</button>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Layout</label>
            <select 
              value={layoutName} 
              onChange={e => setLayoutName(e.target.value)} 
              style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '3px', width: '90px' }}
            >
              <option value="cose-bilkent">Force Directed</option>
              <option value="breadthfirst">Hierarchical</option>
              <option value="circle">Circle</option>
              <option value="grid">Grid</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Hypergraph</label>
            <select 
              value={hypergraph} 
              onChange={e => setHypergraph(e.target.value)} 
              style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '3px', width: '120px' }}
            >
              <option value="community-detection">Community Detection</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
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
