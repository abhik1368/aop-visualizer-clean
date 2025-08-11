import React, { useEffect, useRef } from 'react';

const SimpleNetworkGraph = ({ data }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    console.log('SimpleNetworkGraph: Received data', data);
    console.log('SimpleNetworkGraph: Container ref', containerRef.current);
    
    if (containerRef.current && data) {
      // Simple text display instead of Cytoscape
      const container = containerRef.current;
      container.innerHTML = `
        <div style="padding: 20px; background: white; border: 1px solid #ccc;">
          <h3>Network Data:</h3>
          <p>Nodes: ${data.nodes?.length || 0}</p>
          <p>Edges: ${data.edges?.length || 0}</p>
          <div>
            <h4>Node Details:</h4>
            ${data.nodes?.map(node => `<p>${node.id}: ${node.label} (${node.type})</p>`).join('') || 'No nodes'}
          </div>
          <div>
            <h4>Edge Details:</h4>
            ${data.edges?.map(edge => `<p>${edge.source} → ${edge.target}</p>`).join('') || 'No edges'}
          </div>
        </div>
      `;
    }
  }, [data]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <div 
        ref={containerRef} 
        style={{ 
          height: '100%', 
          width: '100%', 
          backgroundColor: '#f9f9f9',
          border: '2px solid green'
        }}
      >
        Loading...
      </div>
    </div>
  );
};

export default SimpleNetworkGraph;
