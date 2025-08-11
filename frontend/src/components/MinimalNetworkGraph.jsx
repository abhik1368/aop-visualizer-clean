import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

const MinimalNetworkGraph = ({ data }) => {
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);

  useEffect(() => {
    console.log('MinimalNetworkGraph: useEffect triggered');
    console.log('Container ref:', containerRef.current);
    console.log('Data:', data);

    if (!containerRef.current) {
      console.log('No container ref');
      return;
    }

    if (!data || !data.nodes || data.nodes.length === 0) {
      console.log('No data to render');
      return;
    }

    try {
      console.log('Creating Cytoscape instance...');
      
      // Destroy existing instance
      if (cy) {
        cy.destroy();
      }

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

      console.log('Elements to render:', elements);

      const cytoscapeInstance = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#3b82f6',
              'label': 'data(label)',
              'color': '#000',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px',
              'width': '30px',
              'height': '30px'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle'
            }
          }
        ],
        layout: {
          name: 'grid',
          padding: 50
        }
      });

      console.log('Cytoscape instance created:', cytoscapeInstance);
      console.log('Elements count:', cytoscapeInstance.elements().length);
      
      setCy(cytoscapeInstance);

      return () => {
        if (cytoscapeInstance) {
          cytoscapeInstance.destroy();
        }
      };

    } catch (error) {
      console.error('Error creating Cytoscape instance:', error);
    }
  }, [data, cy]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div 
        ref={containerRef} 
        style={{ 
          height: '100%', 
          width: '100%', 
          border: '1px solid #ccc',
          backgroundColor: '#fff'
        }}
      />
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        background: 'rgba(255,255,255,0.9)', 
        padding: '5px',
        fontSize: '12px'
      }}>
        Nodes: {data?.nodes?.length || 0}, Edges: {data?.edges?.length || 0}
      </div>
    </div>
  );
};

export default MinimalNetworkGraph;
