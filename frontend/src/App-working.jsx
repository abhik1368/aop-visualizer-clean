import React, { useState } from 'react';
import NetworkGraph from './components/NetworkGraph';
import './App.css';
import './index.css';

// Simple sample data for testing
const sampleData = {
  nodes: [
    { id: '1', label: 'Estrogen Receptor Binding', type: 'MolecularInitiatingEvent' },
    { id: '2', label: 'Cell Proliferation', type: 'KeyEvent' },
    { id: '3', label: 'Tumor Formation', type: 'KeyEvent' },
    { id: '4', label: 'Breast Cancer', type: 'AdverseOutcome' }
  ],
  edges: [
    { source: '1', target: '2' },
    { source: '2', target: '3' },
    { source: '3', target: '4' }
  ]
};

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [data, setData] = useState(sampleData);

  const handleNodeSelect = (nodeData) => {
    console.log('Selected node:', nodeData);
    setSelectedNode(nodeData);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Main Network View */}
      <div style={{ flex: '1', backgroundColor: '#f8f9fa', position: 'relative' }}>
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '10px', 
          zIndex: 1000,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>AOP Network Visualizer</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            Click any node to see details
          </p>
        </div>
        
        <NetworkGraph 
          data={data}
          onNodeSelect={handleNodeSelect}
          selectedNode={selectedNode}
        />
      </div>

      {/* Side Panel */}
      <div style={{ 
        width: '350px', 
        backgroundColor: 'white', 
        borderLeft: '1px solid #e0e0e0',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>Node Details</h2>
        
        {selectedNode ? (
          <div>
            <div style={{ 
              background: '#f5f5f5', 
              padding: '15px', 
              borderRadius: '5px',
              marginBottom: '15px'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>
                {selectedNode.label}
              </h3>
              <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                <strong>ID:</strong> {selectedNode.id}
              </p>
              <p style={{ margin: '0', fontSize: '14px' }}>
                <strong>Type:</strong> {selectedNode.type}
              </p>
            </div>
            
            {/* Placeholder for path information */}
            <div style={{ 
              background: '#e3f2fd', 
              padding: '15px', 
              borderRadius: '5px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1976d2' }}>
                Path Information
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                Click a node to see the complete path from MIE to AO including this node.
              </p>
            </div>
            
            {/* Network Stats */}
            <div style={{ 
              background: '#f0f0f0', 
              padding: '15px', 
              borderRadius: '5px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Network Stats</h4>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>
                Total Nodes: {data.nodes.length}
              </p>
              <p style={{ margin: '0', fontSize: '12px' }}>
                Total Edges: {data.edges.length}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontSize: '14px',
            marginTop: '50px'
          }}>
            <p>Select a node to view details</p>
            <p style={{ fontSize: '12px', marginTop: '20px' }}>
              The network shows an Adverse Outcome Pathway (AOP) with:<br/>
              • Green triangles: Molecular Initiating Events (MIE)<br/>
              • Blue circles: Key Events<br/>
              • Pink diamonds: Adverse Outcomes (AO)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
