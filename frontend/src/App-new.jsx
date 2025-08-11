import React, { useState } from 'react';
import NetworkGraph from './components/NetworkGraph-fresh';
import './App.css';
import './index.css';

// Enhanced sample data with more nodes to simulate a complex network
const sampleData = {
  nodes: [
    // MIE nodes
    { id: '1', label: 'Estrogen Receptor Binding', type: 'MolecularInitiatingEvent' },
    { id: '2', label: 'Aryl Hydrocarbon Receptor', type: 'MolecularInitiatingEvent' },
    
    // Key Events
    { id: '3', label: 'Cell Proliferation', type: 'KeyEvent' },
    { id: '4', label: 'Oxidative Stress', type: 'KeyEvent' },
    { id: '5', label: 'DNA Damage', type: 'KeyEvent' },
    { id: '6', label: 'Apoptosis Inhibition', type: 'KeyEvent' },
    { id: '7', label: 'Tumor Formation', type: 'KeyEvent' },
    { id: '8', label: 'Angiogenesis', type: 'KeyEvent' },
    { id: '9', label: 'Metastasis', type: 'KeyEvent' },
    { id: '10', label: 'Immune Suppression', type: 'KeyEvent' },
    { id: '11', label: 'Hormone Disruption', type: 'KeyEvent' },
    { id: '12', label: 'Tissue Remodeling', type: 'KeyEvent' },
    { id: '13', label: 'Inflammatory Response', type: 'KeyEvent' },
    { id: '14', label: 'Cellular Senescence', type: 'KeyEvent' },
    { id: '15', label: 'Mitochondrial Dysfunction', type: 'KeyEvent' },
    { id: '16', label: 'Protein Aggregation', type: 'KeyEvent' },
    { id: '17', label: 'Membrane Disruption', type: 'KeyEvent' },
    { id: '18', label: 'Ion Channel Disruption', type: 'KeyEvent' },
    { id: '19', label: 'Neurotransmitter Imbalance', type: 'KeyEvent' },
    { id: '20', label: 'Synaptic Dysfunction', type: 'KeyEvent' },
    
    // Adverse Outcomes
    { id: '21', label: 'Breast Cancer', type: 'AdverseOutcome' },
    { id: '22', label: 'Liver Cancer', type: 'AdverseOutcome' },
    { id: '23', label: 'Neurodegeneration', type: 'AdverseOutcome' },
    { id: '24', label: 'Reproductive Toxicity', type: 'AdverseOutcome' },
    { id: '25', label: 'Cardiovascular Disease', type: 'AdverseOutcome' }
  ],
  edges: [
    { source: '1', target: '3' },
    { source: '1', target: '11' },
    { source: '2', target: '4' },
    { source: '2', target: '13' },
    { source: '3', target: '5' },
    { source: '3', target: '6' },
    { source: '4', target: '5' },
    { source: '4', target: '15' },
    { source: '5', target: '7' },
    { source: '6', target: '7' },
    { source: '7', target: '8' },
    { source: '7', target: '21' },
    { source: '8', target: '9' },
    { source: '9', target: '21' },
    { source: '10', target: '21' },
    { source: '11', target: '24' },
    { source: '12', target: '25' },
    { source: '13', target: '12' },
    { source: '13', target: '10' },
    { source: '14', target: '23' },
    { source: '15', target: '16' },
    { source: '15', target: '22' },
    { source: '16', target: '17' },
    { source: '17', target: '18' },
    { source: '18', target: '19' },
    { source: '19', target: '20' },
    { source: '20', target: '23' },
    { source: '4', target: '22' },
    { source: '13', target: '25' }
  ]
};

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [data, setData] = useState(sampleData);
  const [nodeSize, setNodeSize] = useState(20);
  const [fontSize, setFontSize] = useState(8);

  const handleNodeSelect = (nodeData) => {
    console.log('Selected node:', nodeData);
    setSelectedNode(nodeData);
  };

  const resetSettings = () => {
    setNodeSize(20);
    setFontSize(8);
    setSelectedNode(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5' }}>
      
      {/* Main Network View */}
      <div style={{ flex: '1', position: 'relative' }}>
        <NetworkGraph 
          data={data}
          onNodeSelect={handleNodeSelect}
          selectedNode={selectedNode}
          nodeSize={nodeSize}
          fontSize={fontSize}
        />
      </div>

      {/* Right Panel */}
      <div style={{ 
        width: '300px', 
        backgroundColor: 'white', 
        borderLeft: '1px solid #e0e0e0',
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        
        {/* Node Selection Panel */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>Node Selection</h3>
          </div>
          
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280' }}>
            <span style={{ color: '#3b82f6' }}>Click any node</span> to highlight:
          </p>
          
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#f97316', borderRadius: '50%' }}></div>
              <span>Selected node</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#eab308', borderRadius: '50%' }}></div>
              <span>1-hop neighbors</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%' }}></div>
              <span>2-hop neighbors</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div>
              <span>3-hop neighbors</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#8b5cf6', borderRadius: '50%' }}></div>
              <span>4-hop neighbors</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              • Edges colored by distance
            </div>
          </div>
        </div>

        {/* Network Stats */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>Network Stats</h3>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div><strong>Nodes:</strong> {data.nodes.length}</div>
            <div><strong>Edges:</strong> {data.edges.length}</div>
          </div>
        </div>

        {/* Node Style Controls */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>Node Style</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>
              Size: {nodeSize}px
            </label>
            <input 
              type="range" 
              min="10" 
              max="40" 
              value={nodeSize} 
              onChange={(e) => setNodeSize(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>
              Font: {fontSize}px
            </label>
            <input 
              type="range" 
              min="6" 
              max="16" 
              value={fontSize} 
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button 
            onClick={resetSettings}
            style={{ 
              width: '100%', 
              padding: '8px', 
              fontSize: '12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>

        {/* Selected Node Details */}
        {selectedNode && (
          <div style={{ 
            background: 'white', 
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>Selected Node</h3>
            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div><strong>ID:</strong> {selectedNode.id}</div>
              <div><strong>Label:</strong> {selectedNode.label}</div>
              <div><strong>Type:</strong> {selectedNode.type}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
