import React, { useState, useEffect } from 'react';
import NetworkGraph from './components/NetworkGraph';
import './index.css';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [theme, setTheme] = useState('light');

  // Load sample data
  useEffect(() => {
    const sampleData = {
      nodes: [
        {
          id: 'MIE_1',
          label: 'Binding to estrogen receptor',
          type: 'MolecularInitiatingEvent',
          title: 'Estrogen receptor binding event'
        },
        {
          id: 'KE_1',
          label: 'Increased transcription',
          type: 'KeyEvent',
          title: 'Transcriptional activation'
        },
        {
          id: 'KE_2',
          label: 'Cell proliferation',
          type: 'KeyEvent',
          title: 'Cellular proliferation event'
        },
        {
          id: 'AO_1',
          label: 'Breast cancer',
          type: 'AdverseOutcome',
          title: 'Breast carcinogenesis'
        }
      ],
      edges: [
        {
          source: 'MIE_1',
          target: 'KE_1',
          relationship: 'leads_to'
        },
        {
          source: 'KE_1',
          target: 'KE_2',
          relationship: 'leads_to'
        },
        {
          source: 'KE_2',
          target: 'AO_1',
          relationship: 'leads_to'
        }
      ]
    };

    console.log('Loading sample AOP data:', sampleData);
    setGraphData(sampleData);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    console.log('Node selected:', node);
  };

  return (
    <div className={theme} style={{ height: '100vh', width: '100vw' }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
          AOP Network Visualizer
        </h1>
        <button onClick={toggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'} Toggle Theme
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
        {/* Left Panel */}
        <div style={{ 
          width: '300px', 
          padding: '1rem',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <h3>Control Panel</h3>
          <div style={{ marginTop: '1rem' }}>
            <p>Nodes: {graphData?.nodes?.length || 0}</p>
            <p>Edges: {graphData?.edges?.length || 0}</p>
            {selectedNode && (
              <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <h4>Selected Node:</h4>
                <p><strong>ID:</strong> {selectedNode.id}</p>
                <p><strong>Label:</strong> {selectedNode.label}</p>
                <p><strong>Type:</strong> {selectedNode.type}</p>
              </div>
            )}
          </div>
        </div>

        {/* Graph Area */}
        <div style={{ flex: 1, padding: '1rem' }}>
          <div style={{ 
            height: '100%', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            backgroundColor: '#ffffff'
          }}>
            <NetworkGraph
              data={graphData}
              onNodeSelect={handleNodeSelect}
              selectedNode={selectedNode}
              theme={theme}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ 
          width: '300px', 
          padding: '1rem',
          borderLeft: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <h3>Path Visualization</h3>
          <div style={{ marginTop: '1rem' }}>
            <p>Click a node to see paths through it</p>
            {selectedNode && (
              <div style={{ marginTop: '1rem' }}>
                <p>Analyzing paths through: <strong>{selectedNode.label}</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
