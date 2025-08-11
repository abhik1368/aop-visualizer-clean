import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(fcose);
cytoscape.use(coseBilkent);

// Simple connected components for community detection
const detectCommunities = (adjacencyList, nodeMap) => {
  const nodeIds = Object.keys(adjacencyList);
  const communities = [];
  const visited = new Set();
  
  if (nodeIds.length === 0) return communities;
  
  const dfs = (nodeId, component) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    component.push(nodeMap[nodeId]);
    
    const neighbors = adjacencyList[nodeId] || [];
    neighbors.forEach(neighborId => {
      if (nodeMap[neighborId] && !visited.has(neighborId)) {
        dfs(neighborId, component);
      }
    });
  };
  
  nodeIds.forEach(nodeId => {
    if (!visited.has(nodeId)) {
      const component = [];
      dfs(nodeId, component);
      
      if (component.length > 0) {
        const typeDistribution = {};
        component.forEach(node => {
          const type = node.type || 'other';
          typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
        
        const dominantType = Object.entries(typeDistribution)
          .sort((a, b) => b[1] - a[1])[0][0];
        
        communities.push({
          nodes: component,
          dominantType,
          typeDistribution
        });
      }
    }
  });
  
  return communities;
};

// Calculate positions for all hypernodes in a layout
const calculateHypernodePositions = (communities) => {
  const positions = {};
  const padding = 300; // Space between hypernodes
  
  // Arrange hypernodes in a grid pattern
  const cols = Math.ceil(Math.sqrt(communities.length));
  const rows = Math.ceil(communities.length / cols);
  
  communities.forEach((community, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    const x = (col - (cols - 1) / 2) * padding;
    const y = (row - (rows - 1) / 2) * padding;
    
    positions[community.globalId] = { x, y };
    console.log(`Hypernode ${community.globalId} (${community.originalType}) positioned at (${x}, ${y})`);
  });
  
  return positions;
};

// Force-directed positioning within hypernode to prevent overlaps
const calculateNodePositionInHypernode = (node, communityGlobalId, communities, hypernodePositions) => {
  if (communityGlobalId === undefined) {
    // Isolated node - place it randomly
    return {
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200
    };
  }
  
  // Find the community
  const community = communities.find(c => c.globalId === communityGlobalId);
  if (!community) {
    return { x: 0, y: 0 };
  }
  
  // Get hypernode center position
  const hypernodePos = hypernodePositions[community.globalId];
  if (!hypernodePos) {
    return { x: 0, y: 0 };
  }
  
  // Calculate hypernode size based on member count
  const memberCount = community.nodes.length;
  const baseSize = Math.max(150, Math.min(400, 150 + (memberCount * 6))); // Larger size for force layout
  const availableRadius = (baseSize / 2) - 30;
  
  // Use force-directed positioning within the hypernode
  return forceDirectedPositionInHypernode(node, community, hypernodePos, availableRadius);
};

// Enhanced force-directed algorithm with guaranteed no overlaps
const forceDirectedPositionInHypernode = (targetNode, community, center, maxRadius) => {
  const nodeRadius = 30; // Increased node radius for collision detection
  const minDistance = nodeRadius * 3.5; // Increased minimum distance (105px)
  
  if (community.nodes.length === 1) {
    return { x: center.x, y: center.y };
  }
  
  // Initialize positions with maximum initial spread
  let positions = community.nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / community.nodes.length;
    const radius = Math.min(maxRadius * 0.7, 80); // Wider initial spread
    return {
      id: node.id,
      x: center.x + radius * Math.cos(angle) + (Math.random() - 0.5) * 60,
      y: center.y + radius * Math.sin(angle) + (Math.random() - 0.5) * 60,
      vx: 0,
      vy: 0
    };
  });
  
  // Enhanced force simulation with stronger separation
  const iterations = 200; // More iterations for better convergence
  const damping = 0.8; // Less damping for more movement
  const repulsionStrength = 5000; // Much stronger repulsion
  const centeringStrength = 0.01; // Weaker centering to maximize spread
  
  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    positions.forEach(pos => {
      pos.fx = 0;
      pos.fy = 0;
    });
    
    // Very strong repulsion between nodes
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Apply repulsion even at larger distances for better spread
        if (distance < minDistance * 1.5 && distance > 0) {
          const force = repulsionStrength / (distance * distance + 1); // Added +1 to prevent division by zero
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          positions[i].fx += fx;
          positions[i].fy += fy;
          positions[j].fx -= fx;
          positions[j].fy -= fy;
        }
      }
    }
    
    // Minimal centering force to maximize spread
    positions.forEach(pos => {
      const dx = center.x - pos.x;
      const dy = center.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only apply centering if very close to boundary
      if (distance > maxRadius * 0.95) {
        const force = centeringStrength * (distance - maxRadius * 0.95);
        pos.fx += (dx / distance) * force;
        pos.fy += (dy / distance) * force;
      }
    });
    
    // Apply forces and update positions
    positions.forEach(pos => {
      pos.vx = (pos.vx + pos.fx) * damping;
      pos.vy = (pos.vy + pos.fy) * damping;
      pos.x += pos.vx;
      pos.y += pos.vy;
      
      // Hard constraint to hypernode bounds
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > maxRadius * 0.98) { // Use almost full space
        pos.x = center.x + (dx / distance) * maxRadius * 0.98;
        pos.y = center.y + (dy / distance) * maxRadius * 0.98;
        // Reset velocity when hitting boundary
        pos.vx *= 0.5;
        pos.vy *= 0.5;
      }
    });
  }
  
  // Final overlap check and correction
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        // Force separation
        const overlap = minDistance - distance;
        const separationX = (dx / distance) * (overlap / 2);
        const separationY = (dy / distance) * (overlap / 2);
        
        positions[i].x += separationX;
        positions[i].y += separationY;
        positions[j].x -= separationX;
        positions[j].y -= separationY;
        
        // Ensure still within bounds
        [positions[i], positions[j]].forEach(pos => {
          const distFromCenter = Math.sqrt((pos.x - center.x) ** 2 + (pos.y - center.y) ** 2);
          if (distFromCenter > maxRadius * 0.98) {
            const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
            pos.x = center.x + Math.cos(angle) * maxRadius * 0.98;
            pos.y = center.y + Math.sin(angle) * maxRadius * 0.98;
          }
        });
      }
    }
  }
  
  // Return position for the target node
  const targetPos = positions.find(pos => pos.id === targetNode.id);
  return targetPos ? { x: targetPos.x, y: targetPos.y } : { x: center.x, y: center.y };
};

// Hypergraph component with community-based clustering
const HypergraphNetworkGraph = ({
  data,
  hypergraphData = null,
  onNodeSelect,
  onEdgeSelect,
  selectedNode,
  selectedEdge,
  theme = 'light',
  hypergraphEnabled = false,
  maxNodesPerHypernode = 4, // Default to 4 nodes per hypernode
  layoutType = 'fcose',
  communityMethod = 'louvain',
  communityData = null,
  selectedNodeChain = [],
  searchPanelRef
}) => {
  // State for node size and font size controls
  const [baseNodeSize, setBaseNodeSize] = useState(35);
  const [fontSize, setFontSize] = useState(9);
  const [nodeSizingMode, setNodeSizingMode] = useState('betweenness'); // 'fixed', 'degree', 'betweenness'
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
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
  const rawData = {
    nodes: data.nodes || [],
    edges: data.edges || []
  };

  // Filter out isolated nodes (nodes with no incoming or outgoing connections)
  const filterIsolatedNodes = (nodes, edges) => {
    if (!nodes || nodes.length === 0) return { nodes: [], edges: [] };
    
    // Create a set of node IDs that have connections
    const connectedNodeIds = new Set();
    
    edges.forEach(edge => {
      if (edge && edge.source && edge.target) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
    });
    
    // Filter nodes to only include those with connections
    const connectedNodes = nodes.filter(node => {
      if (!node || !node.id) return false;
      return connectedNodeIds.has(node.id);
    });
    
    console.log(`Filtered isolated nodes: ${nodes.length} → ${connectedNodes.length} nodes (removed ${nodes.length - connectedNodes.length} isolated nodes)`);
    
    return {
      nodes: connectedNodes,
      edges: edges
    };
  };

  // Apply isolated node filtering
  const safeData = filterIsolatedNodes(rawData.nodes, rawData.edges);

  // Calculate node centrality measures with robust error handling
  const calculateCentrality = (nodes, edges) => {
    if (!nodes || nodes.length === 0) {
      return new Map();
    }
    
    const nodeMap = new Map();
    const adjacencyList = new Map();
    
    // Initialize nodes
    nodes.forEach(node => {
      if (node && node.id) {
        nodeMap.set(node.id, node);
        adjacencyList.set(node.id, new Set());
      }
    });
    
    // Build adjacency list with validation
    if (edges && Array.isArray(edges)) {
      edges.forEach(edge => {
        if (edge && edge.source && edge.target) {
          const source = edge.source;
          const target = edge.target;
          if (adjacencyList.has(source) && adjacencyList.has(target)) {
            adjacencyList.get(source).add(target);
            adjacencyList.get(target).add(source);
          }
        }
      });
    }
    
    const centrality = new Map();
    
    // Calculate degree centrality
    nodes.forEach(node => {
      if (node && node.id) {
        const degree = adjacencyList.get(node.id)?.size || 0;
        centrality.set(node.id, { degree, betweenness: 0 });
      }
    });
    
    // Calculate betweenness centrality (simplified Brandes algorithm)
    nodes.forEach(source => {
      const stack = [];
      const paths = new Map();
      const sigma = new Map();
      const distance = new Map();
      const delta = new Map();
      
      // Initialize
      nodes.forEach(node => {
        paths.set(node.id, []);
        sigma.set(node.id, 0);
        distance.set(node.id, -1);
        delta.set(node.id, 0);
      });
      
      sigma.set(source.id, 1);
      distance.set(source.id, 0);
      
      const queue = [source.id];
      
      // BFS
      while (queue.length > 0) {
        const v = queue.shift();
        stack.push(v);
        
        adjacencyList.get(v).forEach(w => {
          // First time we reach w?
          if (distance.get(w) < 0) {
            queue.push(w);
            distance.set(w, distance.get(v) + 1);
          }
          // Shortest path to w via v?
          if (distance.get(w) === distance.get(v) + 1) {
            sigma.set(w, sigma.get(w) + sigma.get(v));
            paths.get(w).push(v);
          }
        });
      }
      
      // Accumulation
      while (stack.length > 0) {
        const w = stack.pop();
        paths.get(w).forEach(v => {
          delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
        });
        if (w !== source.id) {
          const current = centrality.get(w);
          centrality.set(w, { ...current, betweenness: current.betweenness + delta.get(w) });
        }
      }
    });
    
    return centrality;
  };
  
  // Calculate centrality measures with error handling
  let centralityMeasures = new Map();
  try {
    if (safeData.nodes.length > 0 && safeData.edges.length >= 0) {
      centralityMeasures = calculateCentrality(safeData.nodes, safeData.edges);
    }
  } catch (error) {
    console.warn('Error calculating centrality measures:', error);
    // Initialize with default values
    safeData.nodes.forEach(node => {
      centralityMeasures.set(node.id, { degree: 1, betweenness: 0 });
    });
  }
  
  // Get node size based on centrality with robust error handling
  const getNodeSize = (nodeId) => {
    try {
      if (nodeSizingMode === 'fixed') {
        return baseNodeSize;
      }
      
      const measures = centralityMeasures.get(nodeId);
      if (!measures) {
        console.warn(`No centrality measures found for node ${nodeId}, using base size`);
        return baseNodeSize;
      }
      
      if (nodeSizingMode === 'degree') {
        const value = measures.degree || 0;
        const allDegrees = Array.from(centralityMeasures.values()).map(m => m.degree || 0);
        const maxDegree = Math.max(...allDegrees, 1); // Ensure at least 1 to avoid division by zero
        const normalizedValue = maxDegree > 0 ? value / maxDegree : 0;
        return Math.max(15, Math.min(150, baseNodeSize * (0.5 + normalizedValue * 1.5))); // Scale between 0.5x and 2x base size, max 150px
      } else if (nodeSizingMode === 'betweenness') {
        const value = measures.betweenness || 0;
        const allBetweenness = Array.from(centralityMeasures.values()).map(m => m.betweenness || 0);
        const maxBetweenness = Math.max(...allBetweenness, 1); // Ensure at least 1 to avoid division by zero
        const normalizedValue = maxBetweenness > 0 ? value / maxBetweenness : 0;
        return Math.max(15, Math.min(150, baseNodeSize * (0.5 + normalizedValue * 1.5))); // Scale between 0.5x and 2x base size, max 150px
      }
      
      return baseNodeSize;
    } catch (error) {
      console.warn(`Error calculating size for node ${nodeId}:`, error);
      return baseNodeSize;
    }
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
      let nodes = [];
      let hyperNodes = [];
      let hyperEdges = [];
      let edges = [];
      
      if (hypergraphEnabled && hypergraphData) {
        // Use hypergraph data from backend
        console.log('Using hypergraph data from backend with', hypergraphData.nodes?.length, 'total elements');
        
        // Separate regular nodes, hypernodes, and edges from backend data
        const regularNodes = [];
        const backendHypernodes = [];
        const regularEdges = [];
        const hypernodeConnections = [];
        
        // Process nodes from backend
        hypergraphData.nodes?.forEach(node => {
          if (node.type === 'type-hypernode' || node.type === 'community-hypernode' || node.type === 'stressor-hypernode') {
            backendHypernodes.push(node);
          } else {
            regularNodes.push(node);
          }
        });
        
        // Process edges from backend
        hypergraphData.edges?.forEach(edge => {
          if (edge.type === 'hypernode-connection' || edge.type === 'community-connection' || 
              edge.type === 'stressor-connection' || edge.type === 'stressor-aop-connection' || 
              edge.type === 'stressor-mie-connection' || edge.type === 'stressor-adverse-hyperedge' ||
              edge.type === 'stressor-hypernode-connection' || edge.type === 'stressor-to-aop-hypernode') {
            hypernodeConnections.push(edge);
          } else {
            regularEdges.push(edge);
          }
        });
        
        console.log('Backend data breakdown:', {
          regularNodes: regularNodes.length,
          hypernodes: backendHypernodes.length,
          regularEdges: regularEdges.length,
          hypernodeConnections: hypernodeConnections.length
        });
        
        // Create node-to-hypernode mapping
        const nodeToHypernode = {};
        hypernodeConnections.forEach(conn => {
          if (conn.type === 'hypernode-connection' || conn.type === 'community-connection' || 
              conn.type === 'stressor-connection') {
            // These connections go from regular node to hypernode
            const nodeId = conn.source;
            const hypernodeId = conn.target;
            
            // Find the hypernode
            const hypernode = backendHypernodes.find(h => h.id === hypernodeId);
            if (hypernode && hypernode.members?.includes(nodeId)) {
              nodeToHypernode[nodeId] = hypernodeId;
            }
          }
        });
        
        // Calculate hypernode positions
        const hypernodePositions = calculateHypernodePositions(backendHypernodes.map((h, idx) => ({
          globalId: idx,
          originalType: h.original_type || h.type,
          nodes: h.members?.map(id => ({ id })) || []
        })));
        
        // Create cytoscape nodes from regular nodes
        nodes = regularNodes.map(node => {
          const hypernodeId = nodeToHypernode[node.id];
          const hypernodeIdx = backendHypernodes.findIndex(h => h.id === hypernodeId);
          
          // Calculate position within hypernode or standalone
          let position;
          if (hypernodeId && hypernodeIdx >= 0) {
            const hypernode = backendHypernodes[hypernodeIdx];
            const community = {
              globalId: hypernodeIdx,
              nodes: hypernode.members?.map(id => ({ id })) || []
            };
            position = calculateNodePositionInHypernode(node, hypernodeIdx, [community], hypernodePositions);
          } else {
            position = { x: Math.random() * 400 - 200, y: Math.random() * 400 - 200 };
          }
          
          return {
            data: {
              id: node.id,
              label: node.label || node.id,
              type: node.type,
              parent: hypernodeId, // Assign to hypernode if exists
              isHyper: false,
              ...node
            },
            position: position,
            classes: `base-node node-${node.type?.toLowerCase() || 'other'}`
          };
        });
        
        // Create cytoscape hypernodes
        backendHypernodes.forEach((hypernode, idx) => {
          const hypernodeType = hypernode.type;
          let label = hypernode.label;
          
          // Special styling for stressor hypernodes
          if (hypernodeType === 'stressor-hypernode') {
            label = `Stressors (${hypernode.member_count || 0})`;
          }
          
          hyperNodes.push({
            data: {
              id: hypernode.id,
              label: label,
              type: 'hypernode',
              hypernode_type: hypernodeType,
              original_type: hypernode.original_type || (hypernodeType === 'stressor-hypernode' ? 'Stressor' : 'other'),
              member_count: hypernode.member_count || hypernode.members?.length || 0,
              member_nodes: hypernode.members || [],
              aop: hypernode.aop,
              isHyper: true
            },
            position: hypernodePositions[idx] || { x: 0, y: 0 },
            classes: `hypernode hypernode-${hypernodeType.toLowerCase()}`
          });
        });
        
        // Create hyperedges for stressor connection types
        hypernodeConnections.forEach(conn => {
          if (conn.type === 'stressor-aop-connection' || conn.type === 'stressor-mie-connection' || 
              conn.type === 'stressor-adverse-hyperedge' || conn.type === 'stressor-hypernode-connection' || 
              conn.type === 'stressor-to-aop-hypernode') {
            hyperEdges.push({
              data: {
                id: conn.id,
                source: conn.source,
                target: conn.target,
                type: conn.type,
                isHyper: true,
                label: conn.label || conn.aop || 'Stressor Connection'
              },
              classes: `hyperedge ${conn.type.replace('-', '_')}`
            });
          }
        });
        
        // Also add regular edges
        edges = safeData.edges.map(edge => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'regular',
            isHyper: false
          },
          classes: 'base-edge'
        }));
        
      } else if (hypergraphEnabled) {
        // Original local hypergraph creation code
        console.log('Creating hypernodes using type-aware community detection');
        
        // Build adjacency list for community detection
        const adjacencyList = {};
        const nodeMap = {};
        
        // Initialize adjacency list
        safeData.nodes.forEach(node => {
          adjacencyList[node.id] = [];
          nodeMap[node.id] = node;
        });
        
        // Add edges to adjacency list
        safeData.edges.forEach(edge => {
          if (adjacencyList[edge.source] && adjacencyList[edge.target]) {
            adjacencyList[edge.source].push(edge.target);
            adjacencyList[edge.target].push(edge.source);
          }
        });
        
        // Group nodes by type and create hypernodes
        console.log('Creating type-based hypernodes with maxNodesPerHypernode:', maxNodesPerHypernode);
        
        // Group nodes by their type
        const nodesByType = {};
        safeData.nodes.forEach(node => {
          const type = node.type || 'other';
          if (!nodesByType[type]) {
            nodesByType[type] = [];
          }
          nodesByType[type].push(node);
        });
        
        console.log('Nodes grouped by type:', Object.keys(nodesByType).map(type => `${type}: ${nodesByType[type].length}`).join(', '));
        
        // Create communities for each type, splitting if necessary
        let allCommunities = [];
        let communityCounter = 0;
        
        Object.entries(nodesByType).forEach(([type, typeNodes]) => {
          console.log(`Processing ${type} nodes: ${typeNodes.length} total`);
          
          if (typeNodes.length <= maxNodesPerHypernode) {
            // Create single hypernode for this type
            console.log(`Creating single hypernode for ${type} with ${typeNodes.length} nodes`);
            allCommunities.push({
              nodes: typeNodes,
              dominantType: type,
              typeDistribution: { [type]: typeNodes.length },
              originalType: type,
              globalId: communityCounter++,
              isSplit: false
            });
          } else {
            // Split into multiple hypernodes
            const numHypernodes = Math.ceil(typeNodes.length / maxNodesPerHypernode);
            console.log(`Splitting ${type} into ${numHypernodes} hypernodes`);
            
            for (let i = 0; i < typeNodes.length; i += maxNodesPerHypernode) {
              const chunk = typeNodes.slice(i, i + maxNodesPerHypernode);
              const hypernodeIndex = Math.floor(i / maxNodesPerHypernode) + 1;
              
              console.log(`Creating ${type} hypernode ${hypernodeIndex} with ${chunk.length} nodes`);
              
              allCommunities.push({
                nodes: chunk,
                dominantType: type,
                typeDistribution: { [type]: chunk.length },
                originalType: type,
                globalId: communityCounter++,
                isSplit: true,
                splitIndex: hypernodeIndex,
                totalSplits: numHypernodes
              });
            }
          }
        });
        
        console.log(`Created ${allCommunities.length} hypernodes total`);
        
        // Find any unassigned nodes and create individual hypernodes for them
        const assignedNodeIds = new Set();
        allCommunities.forEach(community => {
          community.nodes.forEach(node => {
            assignedNodeIds.add(node.id);
          });
        });
        
        const unassignedNodes = safeData.nodes.filter(node => !assignedNodeIds.has(node.id));
        if (unassignedNodes.length > 0) {
          console.log(`Creating individual hypernodes for ${unassignedNodes.length} unassigned nodes`);
          unassignedNodes.forEach(node => {
            allCommunities.push({
              nodes: [node],
              dominantType: node.type || 'other',
              typeDistribution: { [node.type || 'other']: 1 },
              globalId: communityCounter++,
              originalType: node.type || 'other'
            });
          });
        }
        
        console.log(`Total communities detected: ${allCommunities.length}`);
        allCommunities.forEach((comm, i) => {
          console.log(`Community ${i} (${comm.originalType}): ${comm.nodes.length} nodes`);
        });
        
        // Create node-to-community mapping
        const nodeToCommunity = {};
        allCommunities.forEach((community, communityIndex) => {
          community.nodes.forEach(node => {
            nodeToCommunity[node.id] = community.globalId;
          });
        });
        
        // Calculate hypernode positions first
        const hypernodePositions = calculateHypernodePositions(allCommunities);
        
        // Create individual nodes as children of community hypernodes with preset positions
        nodes = safeData.nodes.map(node => {
          const communityGlobalId = nodeToCommunity[node.id];
          const hypernodeId = communityGlobalId !== undefined ? `community_${communityGlobalId}` : `isolated_${node.id}`;
          
          // Calculate position within hypernode
          const position = calculateNodePositionInHypernode(node, communityGlobalId, allCommunities, hypernodePositions);
          
          console.log(`Node ${node.id} (${node.type}) assigned to hypernode ${hypernodeId} at position (${position.x}, ${position.y})`);
          
          return {
            data: {
              id: node.id,
              label: node.label || node.id,
              type: node.type,
              parent: hypernodeId, // Assign to community hypernode
              community: communityGlobalId,
              isHyper: false,
              // Include all original node metadata for details panel
              ...node // This spreads all original properties
            },
            position: position, // Set preset position
            classes: `base-node node-${node.type?.toLowerCase() || 'other'}`
          };
        });
        
        // Create hypernodes for each community
        allCommunities.forEach((community, communityIndex) => {
          const hypernodeId = `community_${community.globalId}`;
          const dominantType = community.dominantType;
          const typeDistribution = community.typeDistribution;
          
          console.log(`Creating hypernode ${hypernodeId} for ${community.originalType} with ${community.nodes.length} members:`, community.nodes.map(n => n.id));
          
          // Create descriptive label for type-specific communities
          let label;
          if (community.isSplit) {
            label = `${community.originalType} Group ${community.splitIndex}\n(${community.nodes.length} nodes)`;
          } else {
            label = `${community.originalType} Group\n(${community.nodes.length} nodes)`;
          }
          
          hyperNodes.push({
            data: {
              id: hypernodeId,
              label: label,
              type: 'hypernode',
              original_type: community.originalType,
              member_count: community.nodes.length,
              member_nodes: community.nodes.map(n => n.id),
              community_index: community.globalId,
              type_distribution: typeDistribution,
              isHyper: true
            },
            position: hypernodePositions[community.globalId], // Set preset position
            classes: `hypernode hypernode-${community.originalType.toLowerCase()}`
          });
        });
        
        // Create hyperedges between communities based on meaningful biological connections
        const communityConnections = new Map(); // Use Map to store directional connections with metadata
        
        // Find meaningful connections between communities
        safeData.edges.forEach(edge => {
          const sourceCommunity = nodeToCommunity[edge.source];
          const targetCommunity = nodeToCommunity[edge.target];
          
          if (sourceCommunity !== undefined && targetCommunity !== undefined && 
              sourceCommunity !== targetCommunity) {
            
            // Get community types
            const sourceCommunityType = allCommunities[sourceCommunity].originalType;
            const targetCommunityType = allCommunities[targetCommunity].originalType;
            
            // Only create hyperedges for meaningful biological flows:
            // 1. MIE -> KE (Molecular Initiating Events lead to Key Events)
            // 2. KE -> AO (Key Events lead to Adverse Outcomes)
            // 3. MIE -> AO (Direct pathway from initiating event to outcome)
            const isValidConnection = 
              (sourceCommunityType === 'MolecularInitiatingEvent' && targetCommunityType === 'KeyEvent') ||
              (sourceCommunityType === 'KeyEvent' && targetCommunityType === 'AdverseOutcome') ||
              (sourceCommunityType === 'MolecularInitiatingEvent' && targetCommunityType === 'AdverseOutcome');
            
            if (isValidConnection) {
              // Use directional key: source -> target
              const connectionKey = `${sourceCommunity}_to_${targetCommunity}`;
              
              if (!communityConnections.has(connectionKey)) {
                communityConnections.set(connectionKey, {
                  source: sourceCommunity,
                  target: targetCommunity,
                  sourceType: sourceCommunityType,
                  targetType: targetCommunityType,
                  edgeCount: 1
                });
              } else {
                // Increment edge count for this connection
                communityConnections.get(connectionKey).edgeCount++;
              }
            }
          }
        });
        
        // Create hyperedges for valid community connections
        communityConnections.forEach((connection, connectionKey) => {
          hyperEdges.push({
            data: {
              id: `hyperedge_${connectionKey}`,
              source: `community_${connection.source}`,
              target: `community_${connection.target}`,
              type: 'community-connection',
              isHyper: true,
              sourceType: connection.sourceType,
              targetType: connection.targetType,
              edgeCount: connection.edgeCount,
              label: `${connection.sourceType} → ${connection.targetType} (${connection.edgeCount} edges)`
            },
            classes: 'hyperedge community-connection'
          });
        });
        
        console.log(`Created ${hyperNodes.length} hypernodes and ${hyperEdges.length} meaningful hyperedges`);
        console.log('Hyperedge connections:', Array.from(communityConnections.values()));
      } else {
        // Normal mode - individual nodes
        nodes = safeData.nodes.map(node => ({
          data: {
            id: node.id,
            label: node.label || node.id,
            type: node.type,
            isHyper: false,
            // Include all original node metadata for details panel
            ...node // This spreads all original properties
          },
          classes: `base-node node-${node.type?.toLowerCase() || 'other'}`
        }));
      }
      
      // Prepare edges (only if not already populated in hypergraph mode)
      if (!hypergraphEnabled || !hypergraphData) {
        edges = safeData.edges.map(edge => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'regular',
            isHyper: false
          },
          classes: 'base-edge'
        }));
      }

      // Update counts
      setHyperElementCounts({ 
        hypernodes: hyperNodes.length, 
        hyperedges: hyperEdges.length 
      });

      console.log('Creating cytoscape with elements:', {
        nodes: nodes.length,
        edges: edges.length,
        hyperNodes: hyperNodes.length,
        hyperEdges: hyperEdges.length
      });

      // If we have no elements to render, show a message
      if (nodes.length === 0) {
        console.warn('No nodes to render!');
        return;
      }

      const cytoscapeInstance = cytoscape({
        container: containerRef.current,
        elements: [
          ...hyperNodes, // Add parent nodes first
          ...nodes,      // Then child nodes
          ...edges,
          ...hyperEdges
        ],
        // Enable compound node support
        autoungrabify: false,
        autounselectify: false,
        boxSelectionEnabled: false,
        panningEnabled: true,
        userPanningEnabled: true,
        zoomingEnabled: true,
        userZoomingEnabled: true,
        style: [
          // Individual node styling - colored circles
          {
            selector: 'node',
            style: {
              'width': (node) => getNodeSize(node.data('id')),
              'height': (node) => getNodeSize(node.data('id')),
              'background-color': (node) => {
                const type = node.data('type');
                const isSelected = node.data('is_selected');
                
                if (isSelected) {
                  // Bright colors for selected nodes
                  if (type === 'Stressor') return '#9333ea'; // Bright purple for stressors
                  if (type === 'MolecularInitiatingEvent' || type === 'MIE') return '#10b981'; // Bright green
                  if (type === 'KeyEvent' || type === 'KE') return '#3b82f6';  // Bright blue
                  if (type === 'AdverseOutcome' || type === 'AO') return '#f97316';  // Bright orange
                  return '#6b7280'; // Gray for others
                } else {
                  // Very light pastel colors for non-selected
                  if (type === 'Stressor') return '#e9d5ff'; // Very light purple for stressors
                  if (type === 'MolecularInitiatingEvent' || type === 'MIE') return '#bbf7d0'; // Very light green
                  if (type === 'KeyEvent' || type === 'KE') return '#dbeafe';  // Very light blue
                  if (type === 'AdverseOutcome' || type === 'AO') return '#fed7aa';  // Very light orange
                  return '#e5e7eb'; // Very light gray for others
                }
              },
              'border-width': (node) => node.data('is_selected') ? 3 : 1,
              'border-color': (node) => node.data('is_selected') ? '#000000' : '#6b7280',
              'shape': (node) => {
                const type = node.data('type');
                if (type === 'Stressor') return 'diamond'; // Diamond for stressors
                if (type === 'MolecularInitiatingEvent' || type === 'MIE') return 'triangle'; // Triangle for MIE
                if (type === 'KeyEvent' || type === 'KE') return 'round-rectangle';  // Round square for KE
                if (type === 'AdverseOutcome' || type === 'AO') return 'ellipse';  // Circle for AO
                return 'ellipse'; // Default circle
              },
              'label': 'data(label)',
              'font-size': `${fontSize}px`,
              'font-weight': 'bold',
              'color': '#1f2937',
              'text-valign': 'center',
              'text-halign': 'center',
              'text-outline-width': 0,
              'text-max-width': '80px',
              'text-wrap': 'wrap',
              'opacity': 1.0, // Ensure all nodes are fully opaque
              'z-index': 10
            }
          },
          {
            selector: 'node[hypernode_type = "stressor-hypernode"]',
            style: {
              'background-color': '#f3f4f6',  // Light gray, fully opaque
              'border-color': '#888888',
              'border-width': 2,
              'border-style': 'dashed',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'font-weight': 'bold',
              'color': '#555',
              'width': 90,
              'height': 90,
              'shape': 'round-rectangle'
            }
          },
          // Edge styling
          {
            selector: 'edge',
            style: {
              'width': 1,
              'line-color': '#374151',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#374151',
              'arrow-scale': 0.8,
              'opacity': 0.8,
              'z-index': 5
            }
          },
          // Hypernode compound styling
          {
            selector: '.hypernode',
            style: {
              'background-color': (node) => {
                const originalType = node.data('original_type');
                const hypernodeType = node.data('hypernode_type');
                // More visible background colors for hypernodes
                if (hypernodeType === 'stressor-hypernode' || originalType === 'Stressor') return 'rgba(200, 200, 200, 0.6)'; // Light gray for stressors
                if (originalType === 'KeyEvent' || originalType === 'KE') return 'rgba(147, 197, 253, 0.6)';  // Light blue
                if (originalType === 'MolecularInitiatingEvent' || originalType === 'MIE') return 'rgba(134, 239, 172, 0.6)';   // Light green
                if (originalType === 'AdverseOutcome' || originalType === 'AO') return 'rgba(251, 146, 60, 0.6)';   // Light orange
                return 'rgba(209, 213, 219, 0.6)'; // Light gray for others
              },
              'border-width': 2,
              'border-color': (node) => {
                const originalType = node.data('original_type');
                const hypernodeType = node.data('hypernode_type');
                // Stronger border colors for better visibility
                if (hypernodeType === 'stressor-hypernode' || originalType === 'Stressor') return 'rgba(150, 150, 150, 0.8)'; // Gray border for stressors
                if (originalType === 'KeyEvent' || originalType === 'KE') return 'rgba(59, 130, 246, 0.8)'; // Blue border
                if (originalType === 'MolecularInitiatingEvent' || originalType === 'MIE') return 'rgba(34, 197, 94, 0.8)'; // Green border
                if (originalType === 'AdverseOutcome' || originalType === 'AO') return 'rgba(249, 115, 22, 0.8)'; // Orange border
                return 'rgba(156, 163, 175, 0.5)';
              },
              'border-style': (node) => node.data('hypernode_type') === 'stressor-hypernode' ? 'dashed' : 'solid',
              'shape': (node) => node.data('hypernode_type') === 'stressor-hypernode' ? 'round-rectangle' : 'ellipse',
              'label': 'data(label)',
              'font-size': '12px',
              'font-weight': 'bold',
              'color': '#374151', // Darker gray text for better readability
              'text-valign': 'top',
              'text-halign': 'center',
              'text-margin-x': 0,
              'text-margin-y': (node) => {
                const memberCount = node.data('member_count') || 1;
                const baseSize = Math.max(150, Math.min(400, 150 + (memberCount * 6)));
                // Position label on top of the circular border
                return `-${(baseSize / 4) - 30}px`; 
              },
              'text-background-opacity': 1,
              'text-background-color': 'white',
              'text-background-padding': '2px',
              'text-background-shape': 'roundrectangle',
              'padding': (node) => {
                const memberCount = node.data('member_count') || 1;
                // Dynamic padding based on node count: smaller for fewer nodes
                const basePadding = Math.max(30, Math.min(60, 30 + (memberCount * 2)));
                return `${basePadding}px`;
              },
              'width': (node) => {
                const memberCount = node.data('member_count') || 1;
                // Larger size for force-directed layout
                const baseSize = Math.max(150, Math.min(400, 150 + (memberCount * 6)));
                return `${baseSize}px`;
              },
              'height': (node) => {
                const memberCount = node.data('member_count') || 1;
                // Larger size for force-directed layout
                const baseSize = Math.max(150, Math.min(400, 150 + (memberCount * 6)));
                return `${baseSize}px`;
              },
              'z-index': 0, // Behind individual nodes
              'z-compound-depth': 'bottom',
              'opacity': 1.0 // Fully opaque containers
            }
          },
          // Hyperedge styling
          {
            selector: '.hyperedge',
            style: {
              'width': 3,
              'line-color': '#9ca3af', // Darker gray (gray-400)
              'line-style': 'dashed',
              'opacity': 0.8,
              'z-index': 2, // Above background but below nodes
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#9ca3af',
              'arrow-scale': 1.0
            }
          },
          // Stressor-AOP connection styling
          {
            selector: '.stressor-aop-connection',
            style: {
              'width': 2,
              'line-color': '#a855f7', // Purple for stressor connections
              'line-style': 'dotted',
              'opacity': 0.6,
              'z-index': 3,
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#a855f7',
              'arrow-scale': 0.8
            }
          },
          // Stressor to MIE hypernode connection
          {
            selector: 'edge[type="stressor-mie-connection"]',
            style: {
              'width': 3,
              'line-color': '#9370DB',
              'line-style': 'solid',
              'opacity': 0.8,
              'z-index': 4,
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#9370DB',
              'arrow-scale': 1.0,
              'label': 'data(label)',
              'font-size': '10px',
              'text-rotation': 'autorotate'
            }
          },
          // Stressor to AdverseOutcome hyperedge connection
          {
            selector: 'edge[type="stressor-adverse-hyperedge"]',
            style: {
              'width': 2,
              'line-color': '#9ca3af', // Gray instead of orange for default state
              'line-style': 'solid',
              'opacity': 0.8,
              'z-index': 5,
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#9ca3af', // Gray instead of orange for default state
              'arrow-scale': 1.0,
              'label': 'data(label)',
              'font-size': '10px',
              'font-weight': 'normal',
              'text-rotation': 'autorotate',
              'color': '#6b7280',
              'text-outline-width': 1,
              'text-outline-color': '#ffffff'
            }
          },
          // Selected node styling
          {
            selector: '.selected',
            style: {
              'border-width': 4,
              'border-color': '#ef4444',
              'z-index': 2000
            }
          },
          {
            selector: '.path-node',
            style: {
              'border-width': 3,
              'border-color': '#111827',
              'color': '#111827',
              'z-index': 1500
            }
          },
          {
            selector: '.highlighted',
            style: {
              'border-width': 4,
              'border-color': '#ef4444',
              'z-index': 999
            }
          },
          {
            selector: '.highlighted-edge',
            style: {
              'width': 5,
              'line-color': '#111827',
              'target-arrow-color': '#111827',
              'arrow-scale': 1.2,
              'opacity': 0.15,
              'z-index': 0
            }
          },
          {
            selector: '.hidden',
            style: {
              'display': 'none'
            }
          },
          {
            selector: '.faded',
            style: {
              'opacity': 0.1,
              'z-index': 0
            }
          },
          {
            selector: '.background-hypernode',
            style: {
              'opacity': 0.15,
              'z-index': 0
            }
          }
        ],
        layout: {
          name: hypergraphEnabled ? 'preset' : (layoutType === 'forceatlas2' ? 'fcose' : layoutType), // Use preset for manual positioning
          fit: true,
          padding: 50
        }
      });

      // Preset positioning is already applied via node.position property

      // Add event listeners
      cytoscapeInstance.on('tap', 'node', (evt) => {
        const node = evt.target;
        const nodeData = node.data();
        console.log('Node clicked:', nodeData);
        // Modifier-click to add to node chain via SearchPanel imperative handle
        try {
          const e = evt.originalEvent;
          if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            if (searchPanelRef && searchPanelRef.current && typeof searchPanelRef.current.addToNodeChain === 'function') {
              searchPanelRef.current.addToNodeChain(nodeData.id);
            }
          }
        } catch (err) {
          // no-op
        }
        if (onNodeSelect) {
          onNodeSelect(nodeData);
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
          // Clicked on background - reset to original visualization
          onNodeSelect && onNodeSelect(null);
          onEdgeSelect && onEdgeSelect(null);
          
          // Reset all styling to original state
          cytoscapeInstance.batch(() => {
            // Remove all highlight and fade classes
            cytoscapeInstance.elements().removeClass('highlighted highlighted-edge faded hidden background-hypernode path-node path-edge selected');
            
            // Reset all node styles to original
            cytoscapeInstance.nodes().removeStyle();
            
            // Reset all edge styles to original  
            cytoscapeInstance.edges().removeStyle();
          });
          
          console.log('Background clicked - reset to original visualization');
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
  }, [data, hypergraphData, layoutType, hypergraphEnabled, maxNodesPerHypernode, communityMethod, nodeSizingMode, baseNodeSize]);

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

  // Apply dynamic highlighting based solely on selectedNode (hypergraph-aware)
  useEffect(() => {
    if (!cy) return;

    // Clear previous highlighting/fade classes, but keep path-node/path-edge from chain
    cy.elements().removeClass('highlighted highlighted-edge faded hidden background-hypernode');

    if (!selectedNode) return;

    const node = cy.getElementById(selectedNode.id);
    if (!node || node.length === 0) return;

    // Only compute highlighting for base nodes (isHyper === false)
    const isBase = node.data('isHyper') === false;
    if (!isBase) return; // For hypernodes, keep only the selection ring from the other effect

    const normalizeType = (t) => {
      if (!t) return 'OTHER';
      if (t === 'MIE' || t === 'MolecularInitiatingEvent') return 'MIE';
      if (t === 'KE' || t === 'KeyEvent') return 'KE';
      if (t === 'AO' || t === 'AdverseOutcome') return 'AO';
      if (t === 'Stressor') return 'Stressor';
      return 'OTHER';
    };
    const isMIE = (n) => normalizeType(n.data('type')) === 'MIE';
    const isKE = (n) => normalizeType(n.data('type')) === 'KE';
    const isAO = (n) => normalizeType(n.data('type')) === 'AO';
    const isStressor = (n) => normalizeType(n.data('type')) === 'Stressor';

    try {
      // Get the AOP ID of the selected node
      const selectedAopId = node.data('aop_id') || node.data('aop');
      
      if (!selectedAopId) {
        console.log('No AOP ID found for selected node:', node.data());
        return;
      }

      console.log('Highlighting all nodes for AOP:', selectedAopId);

      // Find ALL nodes that belong to the same AOP (MIE, KE, AO, and Stressors)
      const aopNodes = cy.nodes().filter(n => {
        if (n.data('isHyper') !== false) return false; // Only base nodes
        const nodeAopId = n.data('aop_id') || n.data('aop');
        return nodeAopId === selectedAopId && (isMIE(n) || isKE(n) || isAO(n) || isStressor(n));
      });

      console.log('Found', aopNodes.length, 'nodes for AOP', selectedAopId);

      // Get all edges between these AOP nodes
      const aopEdges = aopNodes.edgesWith(aopNodes).filter(e => e.data('isHyper') === false);

      // Get parent hypernodes for these AOP nodes
      const parentHypernodeIds = new Set();
      aopNodes.forEach(n => {
        const parentId = n.data('parent');
        if (parentId) parentHypernodeIds.add(parentId);
      });

      // Get hyperedges connecting the parent hypernodes
      const hyperEdgesInAop = cy.edges().filter(e => {
        if (!e.data('isHyper')) return false;
        const src = e.data('source');
        const tgt = e.data('target');
        return parentHypernodeIds.has(src) && parentHypernodeIds.has(tgt);
      });

      if (aopNodes.length === 0) return;

      cy.batch(() => {
        // First, remove faded class from AOP nodes to ensure they're visible
        aopNodes.removeClass('faded');
        
        // Highlight all nodes from the same AOP with strong styling
        aopNodes.addClass('path-node');
        aopNodes.style({
          'opacity': 1.0,
          'z-index': 1500,
          'border-width': 4,
          'border-color': '#ef4444', // Red border for AOP nodes instead of orange
          'background-opacity': 1.0,
          'text-opacity': 1.0,
          'overlay-opacity': 0 // Remove any overlay that might hide the node
        });

        // Highlight edges between AOP nodes with bold black styling
        aopEdges.removeClass('faded');
        aopEdges.addClass('highlighted-edge');
        aopEdges.style({
          'width': 2,
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          'opacity': 1.0,
          'z-index': 1000,
          'line-opacity': 1.0
        });

        hyperEdgesInAop.removeClass('faded');
        hyperEdgesInAop.addClass('highlighted-edge');
        hyperEdgesInAop.style({
          'width': 3,
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          'opacity': 1.0,
          'z-index': 1000,
          'line-opacity': 1.0
        });

        // Highlight the parent hypernodes of AOP nodes
        const aopHypernodes = cy.nodes('[isHyper = true]').filter((n) => parentHypernodeIds.has(n.id()));
        aopHypernodes.style({
          'border-width': 4,
          'border-color': '#ef4444', // Red border for hypernodes instead of orange
          'opacity': 1.0,
          'background-opacity': 0.8, // Semi-transparent so child nodes are visible
          'z-index': 100 // Lower than child nodes
        });

        // Fade all other nodes and edges to be very transparent
        cy.nodes('[isHyper = false]').difference(aopNodes).addClass('faded');
        cy.edges('[isHyper = false]').difference(aopEdges).addClass('faded').style({
          'opacity': 0.1,
          'z-index': 1
        });

        // Dim hypernodes not part of this AOP
        cy.nodes('[isHyper = true]').difference(aopHypernodes).addClass('background-hypernode');

        // Fade hyperedges that are not in this AOP to be very transparent
        cy.edges('[isHyper = true]').difference(hyperEdgesInAop).addClass('faded').style({
          'opacity': 0.1,
          'z-index': 1
        });
      });

      // Removed auto-zoom on node selection for better user control
      // cy.animate({ fit: { eles: aopNodes.union(aopEdges).union(hyperEdgesInAop), padding: 80 }, duration: 300 });
    } catch (e) {
      console.warn('Hypergraph: AOP highlight failed:', e);
    }
  }, [cy, selectedNode]);

  // Highlight the explicit selectedNodeChain (independent from selectedNode highlighting)
  useEffect(() => {
    if (!cy) return;
    // Clear previous chain classes only
    cy.elements().removeClass('path-node path-edge');

    if (!selectedNodeChain || selectedNodeChain.length === 0) return;

    cy.batch(() => {
      // Mark chain nodes
      selectedNodeChain.forEach((id) => {
        const n = cy.getElementById(id);
        if (n && n.length > 0) {
          n.addClass('path-node');
        }
      });

      // Mark edges between consecutive nodes (both base edges and connecting hyperedges between parents)
      for (let i = 0; i < selectedNodeChain.length - 1; i++) {
        const a = selectedNodeChain[i];
        const b = selectedNodeChain[i + 1];
        // Base edges in either direction
        const baseEdge = cy.$(`edge[isHyper = false][source = "${a}"][target = "${b}"], edge[isHyper = false][source = "${b}"][target = "${a}"]`);
        if (baseEdge && baseEdge.length > 0) baseEdge.addClass('path-edge');

        // Hyperedge between parent hypernodes if both exist
        const na = cy.getElementById(a);
        const nb = cy.getElementById(b);
        if (na && nb && na.length > 0 && nb.length > 0) {
          const pa = na.data('parent');
          const pb = nb.data('parent');
          if (pa && pb) {
            const hyperEdge = cy.$(`edge[isHyper = true][source = "${pa}"][target = "${pb}"], edge[isHyper = true][source = "${pb}"][target = "${pa}"]`);
            if (hyperEdge && hyperEdge.length > 0) hyperEdge.addClass('path-edge');
          }
        }
      }
    });
  }, [cy, selectedNodeChain]);

  // Update node and font sizes dynamically with error handling
  useEffect(() => {
    if (!cy) return;

    try {
      cy.startBatch();
      cy.nodes().forEach(node => {
        try {
          const nodeId = node.data('id');
          if (nodeId) {
            const dynamicSize = getNodeSize(nodeId);
            // Ensure size is a valid number
            const safeSize = isNaN(dynamicSize) ? baseNodeSize : Math.max(10, Math.min(200, dynamicSize));
            node.style({
              'width': safeSize,
              'height': safeSize,
              'font-size': `${Math.max(6, Math.min(30, fontSize))}px`
            });
          }
        } catch (nodeError) {
          console.warn('Error updating node style:', nodeError);
        }
      });
      cy.endBatch();
    } catch (error) {
      console.error('Error in dynamic sizing update:', error);
    }

  }, [cy, baseNodeSize, fontSize, nodeSizingMode]);

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      <div className="absolute top-2 left-2 z-20 bg-white rounded-lg shadow-md max-w-xs">
        {/* Toggle Button */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-700">Node Controls</span>
          <button
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isPanelCollapsed ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {/* Collapsible Content */}
        {!isPanelCollapsed && (
          <div className="p-3">
            <div className="flex flex-col space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Node Sizing Mode</label>
                <select
                  value={nodeSizingMode}
                  onChange={(e) => setNodeSizingMode(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value="fixed">Fixed Size</option>
                  <option value="degree">By Degree Centrality</option>
                  <option value="betweenness">By Betweenness Centrality</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Base Node Size: {baseNodeSize}</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={baseNodeSize}
                  onChange={(e) => setBaseNodeSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {nodeSizingMode === 'fixed' ? 'All nodes same size' : 'Base size for scaling'}
                </div>
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
        )}
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
