// AOP Data Loader - Loads and processes AOP pathway data from TSV files

// Parse TSV data
const parseTSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split('\t');
  
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
};

// Load AOP data from backend or local files
export const loadAOPData = async () => {
  try {
    console.log('Loading AOP data...');
    
    // Try to load from backend first
    try {
      const response = await fetch('/api/aop-data');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded AOP data from backend:', data);
        return data;
      }
    } catch (error) {
      console.log('Backend not available, loading from local files...');
    }
    
    // Fallback to loading from data directory
    const [ecResponse, kerResponse, mieResponse] = await Promise.all([
      fetch('/data/aop_ke_ec.tsv'),
      fetch('/data/aop_ke_ker.tsv'),
      fetch('/data/aop_ke_mie_ao.tsv')
    ]);
    
    if (!ecResponse.ok || !kerResponse.ok || !mieResponse.ok) {
      throw new Error('Failed to load AOP data files');
    }
    
    const [ecText, kerText, mieText] = await Promise.all([
      ecResponse.text(),
      kerResponse.text(),
      mieResponse.text()
    ]);
    
    const ecData = parseTSV(ecText);
    const kerData = parseTSV(kerText);
    const mieData = parseTSV(mieText);
    
    console.log('Parsed AOP data:', {
      events: ecData.length,
      relationships: kerData.length,
      outcomes: mieData.length
    });
    
    // Process and create network data
    const networkData = processAOPData(ecData, kerData, mieData);
    console.log('Processed network data:', networkData);
    
    return networkData;
    
  } catch (error) {
    console.error('Error loading AOP data:', error);
    
    // Return sample data if loading fails
    return createSampleData();
  }
};

// Process AOP data into network format
const processAOPData = (ecData, kerData, mieData) => {
  const nodes = new Map();
  const edges = [];
  
  // Process Key Events from EC data
  ecData.forEach((event, index) => {
    const nodeId = `event_${index}`;
    const eventTitle = event['Event title'] || event['Title'] || `Event ${index}`;
    const eventType = event['Event type'] || 'KeyEvent';
    const biologicalOrganization = event['Biological organization'] || 'Unknown';
    
    nodes.set(nodeId, {
      id: nodeId,
      label: eventTitle,
      type: eventType,
      category: 'KeyEvent',
      biologicalOrganization,
      data: event,
      group: biologicalOrganization
    });
  });
  
  // Process Key Event Relationships from KER data
  kerData.forEach((relation, index) => {
    const sourceTitle = relation['Upstream event title'] || relation['Source'] || '';
    const targetTitle = relation['Downstream event title'] || relation['Target'] || '';
    const relationshipType = relation['Relationship type'] || 'relates_to';
    
    // Find matching nodes
    let sourceId = null;
    let targetId = null;
    
    for (const [nodeId, node] of nodes) {
      if (node.label.includes(sourceTitle) || sourceTitle.includes(node.label)) {
        sourceId = nodeId;
      }
      if (node.label.includes(targetTitle) || targetTitle.includes(node.label)) {
        targetId = nodeId;
      }
    }
    
    // Create edge if both nodes found
    if (sourceId && targetId && sourceId !== targetId) {
      edges.push({
        id: `edge_${index}`,
        source: sourceId,
        target: targetId,
        label: relationshipType,
        type: relationshipType,
        data: relation
      });
    }
  });
  
  // Process Molecular Initiating Events and Adverse Outcomes from MIE data
  mieData.forEach((outcome, index) => {
    const nodeId = `outcome_${index}`;
    const outcomeTitle = outcome['AO title'] || outcome['Title'] || `Outcome ${index}`;
    const outcomeType = outcome['AO type'] || 'AdverseOutcome';
    
    nodes.set(nodeId, {
      id: nodeId,
      label: outcomeTitle,
      type: outcomeType,
      category: 'AdverseOutcome',
      data: outcome,
      group: 'AdverseOutcome'
    });
  });
  
  return {
    nodes: Array.from(nodes.values()),
    edges: edges
  };
};

// Create sample data for fallback
const createSampleData = () => {
  console.log('Creating sample AOP data...');
  
  const nodes = [
    {
      id: 'mie1',
      label: 'Chemical Binding',
      type: 'MolecularInitiatingEvent',
      category: 'MIE',
      group: 'Molecular'
    },
    {
      id: 'ke1',
      label: 'Protein Dysfunction',
      type: 'KeyEvent',
      category: 'KeyEvent',
      group: 'Protein'
    },
    {
      id: 'ke2',
      label: 'Cellular Response',
      type: 'KeyEvent',
      category: 'KeyEvent',
      group: 'Cellular'
    },
    {
      id: 'ke3',
      label: 'Tissue Damage',
      type: 'KeyEvent',
      category: 'KeyEvent',
      group: 'Tissue'
    },
    {
      id: 'ao1',
      label: 'Organ Toxicity',
      type: 'AdverseOutcome',
      category: 'AO',
      group: 'Organ'
    }
  ];
  
  const edges = [
    {
      id: 'edge1',
      source: 'mie1',
      target: 'ke1',
      label: 'leads to',
      type: 'causation'
    },
    {
      id: 'edge2',
      source: 'ke1',
      target: 'ke2',
      label: 'triggers',
      type: 'causation'
    },
    {
      id: 'edge3',
      source: 'ke2',
      target: 'ke3',
      label: 'results in',
      type: 'causation'
    },
    {
      id: 'edge4',
      source: 'ke3',
      target: 'ao1',
      label: 'causes',
      type: 'causation'
    }
  ];
  
  return { nodes, edges };
};

// Get statistics about the AOP data
export const getAOPStats = (data) => {
  if (!data || !data.nodes || !data.edges) {
    return null;
  }
  
  const nodeTypes = {};
  const edgeTypes = {};
  
  data.nodes.forEach(node => {
    const type = node.category || node.type || 'Unknown';
    nodeTypes[type] = (nodeTypes[type] || 0) + 1;
  });
  
  data.edges.forEach(edge => {
    const type = edge.type || 'Unknown';
    edgeTypes[type] = (edgeTypes[type] || 0) + 1;
  });
  
  return {
    totalNodes: data.nodes.length,
    totalEdges: data.edges.length,
    nodeTypes,
    edgeTypes
  };
};
