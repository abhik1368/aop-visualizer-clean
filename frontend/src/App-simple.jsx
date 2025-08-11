import React, { useState, useEffect } from 'react';
import NetworkGraph from './components/NetworkGraph';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

  // Load initial sample data
  useEffect(() => {
    console.log('App useEffect: Loading sample data');
    
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

  console.log('App rendering with graphData:', graphData);

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      backgroundColor: '#f0f0f0',
      padding: '20px'
    }}>
      <h1 style={{ color: 'black', marginBottom: '20px' }}>
        AOP Network Visualizer - Simple Test
      </h1>
      
      <div style={{ color: 'black', marginBottom: '20px' }}>
        <p>Graph Data: {graphData?.nodes?.length || 0} nodes, {graphData?.edges?.length || 0} edges</p>
      </div>

      <div style={{ 
        height: '600px', 
        width: '100%', 
        border: '2px solid blue',
        backgroundColor: 'white'
      }}>
        <NetworkGraph
          data={graphData}
          onNodeSelect={() => {}}
          onEdgeSelect={() => {}}
          selectedNode={null}
          selectedEdge={null}
          theme="light"
          onPathsUpdate={() => {}}
        />
      </div>
    </div>
  );
}

export default App;
