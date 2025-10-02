import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import euler from 'cytoscape-euler';
import dagre from 'cytoscape-dagre';

// Register supported layouts
cytoscape.use(euler);
cytoscape.use(dagre);

// Pastel palette and helpers for community coloring and WOE detection
const pastelPalette = [
  '#a5b4fc', '#93c5fd', '#86efac', '#f9a8d4', '#fcd34d',
  '#b9fbc0', '#c4b5fd', '#fdcfe8', '#fca5a5', '#99f6e4',
  '#fde68a', '#c7d2fe', '#fbcfe8', '#a7f3d0', '#bfdbfe',
  '#fde2e2', '#e9d5ff', '#d9f99d', '#fecaca', '#bae6fd'
];

const getPastelByIndex = (i) => pastelPalette[i % pastelPalette.length];

const hexToRgba = (hex, alpha = 0.14) => {
  try {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (e) {
    return `rgba(209, 213, 219, ${alpha})`; // fallback gray
  }
};

const isWOENode = (nodeTypeRaw) => {
  const t = (nodeTypeRaw || '').toString().toLowerCase();
  return t === 'woe' || t === 'weightofevidence' || t.includes('weight') || t.includes('evidence');
};

const NODE_COLORS = {
  MIE: { normal: '#6ee7b7', selected: '#10b981' },
  KE: { normal: '#60a5fa', selected: '#2563eb' },
  AO: { normal: '#f472b6', selected: '#ec4899' },
  WOE: { normal: '#e9d5ff', selected: '#a855f7' },
  OTHER: { normal: '#e5e7eb', selected: '#374151' }
};

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

// Calculate positions for all hypernodes using a tighter square grid (more compact, not by type columns)
const calculateHypernodePositions = (communities) => {
  const positions = {};
  const xPadding = 300; // tighter horizontal spacing
  const yPadding = 220; // tighter vertical spacing

  if (!communities || communities.length === 0) return positions;

  // Arrange communities in a square grid for compactness
  const n = communities.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  // Optional: stable ordering that lightly interleaves types without forcing single-type columns
  const typePriority = { MolecularInitiatingEvent: 0, MIE: 0, KeyEvent: 1, KE: 1, AdverseOutcome: 2, AO: 2 };
  const ordered = [...communities].sort((a, b) => {
    const pa = typePriority[a.originalType] ?? 3;
    const pb = typePriority[b.originalType] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.globalId - b.globalId;
  });

  ordered.forEach((community, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = (col - (cols - 1) / 2) * xPadding;
    const y = (row - (rows - 1) / 2) * yPadding;
    positions[community.globalId] = { x, y };
    console.log(`Hypernode ${community.globalId} (${community.originalType}) positioned (grid) at (${x}, ${y})`);
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
  
  // Calculate hypernode size based on member count - optimized for chemical nodes
  const memberCount = community.nodes.length;
  // Smaller initial hypernode size and gentler growth by member count
  const baseSize = Math.max(110, Math.min(220, 110 + (memberCount * 5)));
  const availableRadius = (baseSize / 2) - 25;
  
  // Use force-directed positioning within the hypernode
  return forceDirectedPositionInHypernode(node, community, hypernodePos, availableRadius);
};

// Enhanced force-directed algorithm with guaranteed no overlaps - optimized for chemical nodes
const forceDirectedPositionInHypernode = (targetNode, community, center, maxRadius) => {
  const nodeRadius = 22; // slightly smaller for tighter packing
  const minDistance = nodeRadius * 2.2; // ~48px separation: compact but non-overlapping
  
  if (community.nodes.length === 1) {
    return { x: center.x, y: center.y };
  }
  
  // Use grid-based initial positioning for better chemical node distribution
  const cols = Math.ceil(Math.sqrt(community.nodes.length));
  const rows = Math.ceil(community.nodes.length / cols);
  const cellWidth = (maxRadius * 1.4) / cols;
  const cellHeight = (maxRadius * 1.4) / rows;
  
  let positions = community.nodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    // Grid positioning with some randomization
    const gridX = center.x + (col - (cols - 1) / 2) * cellWidth;
    const gridY = center.y + (row - (rows - 1) / 2) * cellHeight;
    
    return {
      id: node.id,
      x: gridX + (Math.random() - 0.5) * 3, // Minimal random offset to avoid immediate overlap
      y: gridY + (Math.random() - 0.5) * 3,
      vx: 0,
      vy: 0
    };
  });
  
  // Force simulation tuned for compact, non-jittery separation
  const iterations = 110; // fewer iterations to minimize motion
  const damping = 0.95; // higher damping for stability
  const repulsionStrength = 2000; // lower repulsion for tighter packing
  const centeringStrength = 0.18; // stronger centering to keep nodes away from corners
  
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
        
        // Enhanced repulsion for chemical nodes - stronger at close distances
        if (distance < minDistance * 2.0 && distance > 0) {
          let force;
          if (distance < minDistance) {
            // Very strong repulsion when nodes are too close
            force = repulsionStrength / (distance * 0.5 + 1);
          } else {
            // Regular repulsion for spacing
            force = repulsionStrength / (distance * distance + 1);
          }
          
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          positions[i].fx += fx;
          positions[i].fy += fy;
          positions[j].fx -= fx;
          positions[j].fy -= fy;
        }
      }
    }
    
    // Compact centering to keep nodes away from corners and reduce jitter
    positions.forEach(pos => {
      const dx = center.x - pos.x;
      const dy = center.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        // Base centering applied always
        const baseForce = centeringStrength * distance;
        pos.fx += (dx / distance) * baseForce;
        pos.fy += (dy / distance) * baseForce;
        // Extra pull near the boundary to avoid corner clustering
        if (distance > maxRadius * 0.55) {
          const edgeForce = centeringStrength * (distance - maxRadius * 0.55) * 1.3;
          pos.fx += (dx / distance) * edgeForce;
          pos.fy += (dy / distance) * edgeForce;
        }
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
      
      if (distance > maxRadius * 0.55) { // tighter boundary to keep nodes compact
        pos.x = center.x + (dx / distance) * maxRadius * 0.55;
        pos.y = center.y + (dy / distance) * maxRadius * 0.55;
        // Reset velocity when hitting boundary
        pos.vx *= 0.3;
        pos.vy *= 0.3;
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
        // Compact separation with small buffer
        const overlap = minDistance - distance + 4;
        const separationX = (dx / distance) * (overlap * 0.5);
        const separationY = (dy / distance) * (overlap * 0.5);
        
        positions[i].x += separationX;
        positions[i].y += separationY;
        positions[j].x -= separationX;
        positions[j].y -= separationY;
        
        // Ensure still within bounds but allow more spread
        [positions[i], positions[j]].forEach(pos => {
          const distFromCenter = Math.sqrt((pos.x - center.x) ** 2 + (pos.y - center.y) ** 2);
          if (distFromCenter > maxRadius * 0.55) {
            const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
            pos.x = center.x + Math.cos(angle) * maxRadius * 0.55;
            pos.y = center.y + Math.sin(angle) * maxRadius * 0.55;
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
  layoutType = 'euler',
  communityMethod = 'louvain',
  communityData = null
}) => {
  // State for node size and font size controls
  const [baseNodeSize, setBaseNodeSize] = useState(24);
  const [fontSize, setFontSize] = useState(9);
  const [nodeSizingMode, setNodeSizingMode] = useState('betweenness'); // 'fixed', 'degree', 'betweenness'
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [legendItems, setLegendItems] = useState([]);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  
  // Hypernode color and transparency controls
  const [hypernodeColors, setHypernodeColors] = useState({
    MolecularInitiatingEvent: '#86efac', // emerald-300 pastel
    KeyEvent: '#93c5fd',                 // blue-300 pastel
    AdverseOutcome: '#f9a8d4',          // pink-300 pastel
    chemical: '#9CA3AF'                  // gray-400
  });
  const [hypernodeTransparency, setHypernodeTransparency] = useState({
    MolecularInitiatingEvent: 0.14,
    KeyEvent: 0.14,
    AdverseOutcome: 0.14,
    chemical: 0.18
  });
  const [showColorControls, setShowColorControls] = useState(false);
  
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [cy, setCy] = useState(null);
  const [hyperElementCounts, setHyperElementCounts] = useState({ hypernodes: 0, hyperedges: 0 });
  // Layout override for hypergraph (Auto = metadata-driven)
  const [layoutOverride, setLayoutOverride] = useState('euler'); // default to force/euler only
  const initialPositionsRef = useRef({});
  // Chemical visibility controls
  const [showChemicals, setShowChemicals] = useState(false); // default disabled per user request
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, aopId: '', label: '' });

  // Choose source graph: when hypergraph view is enabled and backend provided enhanced graph,
  // prefer hypergraphData so server-added nodes/edges (e.g., chemicals) are included.
  const sourceGraph = (hypergraphEnabled && hypergraphData && Array.isArray(hypergraphData.nodes) && hypergraphData.nodes.length > 0)
    ? hypergraphData
    : data;

  // Safety check - prevent crashes with missing data
  if (!sourceGraph || !sourceGraph.nodes || sourceGraph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 mb-2">No graph data available</div>
          <div className="text-sm text-gray-400">Select an AOP to view the network</div>
          {sourceGraph && <div className="text-xs text-gray-300 mt-2">Nodes: {sourceGraph.nodes?.length || 0}</div>}
        </div>
      </div>
    );
  }

  // Ensure we have nodes and edges, even if empty arrays
  const rawData = {
    nodes: sourceGraph.nodes || [],
    edges: sourceGraph.edges || []
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
      // Always keep WOE nodes and chemical nodes even if isolated
      return connectedNodeIds.has(node.id) || isWOENode(node.type) || node.type === 'chemical';
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

  // Path highlighting helpers
  const clearHighlights = (cyInst) => {
    try {
      if (!cyInst) return;
      cyInst.elements().removeClass('faded highlighted');
    } catch (e) {
      console.warn('clearHighlights error:', e);
    }
  };

  const applyHighlightForNode = (cyInst, nodeId) => {
    try {
      if (!cyInst || !nodeId) return;
      const clicked = cyInst.getElementById(nodeId);
      if (!clicked || clicked.length === 0) return;

      // Start by fading everything, we'll un-fade highlighted elements
      cyInst.elements().addClass('faded').removeClass('highlighted');

      // If a hypernode (compound) is clicked, highlight its members and related hyperedges
      if (clicked.hasClass('hypernode')) {
        // Highlight the hypernode itself
        clicked.removeClass('faded').addClass('highlighted');

        const memberNodes = clicked.descendants('node').filter(n => !n.hasClass('hypernode'));
        memberNodes.forEach(n => n.removeClass('faded').addClass('highlighted'));

        // Highlight edges among member nodes
        const memberIds = new Set(memberNodes.map(n => n.id()));
        cyInst.edges('.base-edge').forEach(e => {
          const s = e.data('source'); const t = e.data('target');
          if (memberIds.has(s) && memberIds.has(t)) {
            e.removeClass('faded').addClass('highlighted');
          }
        });

        // Highlight hyperedges connected to this hypernode
        cyInst.edges('.hyperedge').forEach(e => {
          const s = e.data('source'); const t = e.data('target');
          if (s === clicked.id() || t === clicked.id()) {
            e.removeClass('faded').addClass('highlighted');
          }
        });

        return;
      }

      // Build adjacency (directed) over base nodes/edges
      const baseNodes = cyInst.nodes().filter(n => !n.hasClass('hypernode'));
      const baseEdges = cyInst.edges('.base-edge');

      const adj = new Map();
      const rev = new Map();
      baseNodes.forEach(n => {
        adj.set(n.id(), new Set());
        rev.set(n.id(), new Set());
      });
      baseEdges.forEach(e => {
        const s = e.data('source'); const t = e.data('target');
        if (adj.has(s) && adj.has(t)) {
          adj.get(s).add(t);
          rev.get(t).add(s);
        }
      });

      const bfs = (startIds, map, allowed) => {
        const queue = Array.isArray(startIds) ? [...startIds] : [startIds];
        const visited = new Set(queue);
        while (queue.length) {
          const cur = queue.shift();
          const nbrs = map.get(cur) || new Set();
          nbrs.forEach(nid => {
            if (allowed && !allowed.has(nid)) return;
            if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
          });
        }
        return visited;
      };

      const type = (clicked.data('type') || '').toString();
      let nodeIdsToHighlight = new Set([nodeId]);

      const forward = bfs(nodeId, adj);
      const backward = bfs(nodeId, rev);

      if (type === 'MolecularInitiatingEvent' || type === 'MIE') {
        // Only include nodes on some path to at least one AO
        const aoIds = [];
        forward.forEach(id => {
          const n = cyInst.getElementById(id);
          const t = (n.data('type') || '').toString();
          if (t === 'AdverseOutcome' || t === 'AO') aoIds.push(id);
        });
        if (aoIds.length > 0) {
          const allowed = forward; // restrict to forward-reachable
          const backFromAOs = bfs(aoIds, rev, allowed);
          nodeIdsToHighlight = backFromAOs;
          nodeIdsToHighlight.add(nodeId);
        } else {
          nodeIdsToHighlight = forward;
        }
      } else if (type === 'AdverseOutcome' || type === 'AO') {
        nodeIdsToHighlight = backward;
      } else {
        // KE or other: highlight upstream and downstream
        const union = new Set();
        forward.forEach(id => union.add(id));
        backward.forEach(id => union.add(id));
        nodeIdsToHighlight = union;
      }

      // Highlight nodes and corresponding edges
      const nodeIdsSet = nodeIdsToHighlight;

      // Nodes
      nodeIdsSet.forEach(id => {
        const el = cyInst.getElementById(id);
        if (el && el.length > 0) {
          el.removeClass('faded').addClass('highlighted');
        }
      });

      // Edges between highlighted nodes
      baseEdges.forEach(e => {
        const s = e.data('source'); const t = e.data('target');
        if (nodeIdsSet.has(s) && nodeIdsSet.has(t)) {
          e.removeClass('faded').addClass('highlighted');
        }
      });

      // Highlight parent hypernodes that contain highlighted nodes
      const hyperParentIds = new Set();
      nodeIdsSet.forEach(id => {
        const n = cyInst.getElementById(id);
        const parentId = n.data('parent');
        if (parentId) hyperParentIds.add(parentId);
      });
      hyperParentIds.forEach(hid => {
        const h = cyInst.getElementById(hid);
        if (h && h.length > 0) h.removeClass('faded').addClass('highlighted');
      });

      // Hyperedges connecting highlighted hypernodes
      cyInst.edges('.hyperedge').forEach(e => {
        const s = e.data('source'); const t = e.data('target');
        if (hyperParentIds.has(s) && hyperParentIds.has(t)) {
          e.removeClass('faded').addClass('highlighted');
        }
      });
    } catch (e) {
      console.warn('applyHighlightForNode error:', e);
    }
  };

  // Initialize Cytoscape - Enhanced for dynamic updates
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Destroy existing instance if it exists for clean re-initialization
    if (cy) {
      console.log('HypergraphNetworkGraph: Destroying existing cytoscape instance for dynamic update');
      cy.removeAllListeners();
      cy.destroy();
      setCy(null);
    }
    
    console.log('HypergraphNetworkGraph: Initializing cytoscape with',
      safeData.nodes.length, 'nodes',
      safeData.edges.length, 'edges',
      hypergraphEnabled ? '(hypergraph mode)' : '(normal mode)'
    );

    try {
      let nodes = [];
      let hyperNodes = [];
      let hyperEdges = [];
      
      // Server-provided chemical-only hypergraph mode (no community nodes)
      const serverChemicalOnly = !!(hypergraphEnabled && hypergraphData && hypergraphData.config && hypergraphData.config.useChemicalHypernodesOnly);
      if (serverChemicalOnly) {
        // Build elements strictly from backend-provided nodes (chemical hypernodes + chemicals)
        safeData.nodes.forEach((node) => {
          if (!node || !node.id) return;
          const t = (node.type || node.original_type || '').toString();
          if (t === 'chemical-hypernode') {
            hyperNodes.push({
              data: {
                id: node.id,
                label: node.label || node.id,
                type: 'hypernode',
                original_type: 'chemical',
                member_count: node.member_count || (Array.isArray(node.members) ? node.members.length : 0),
                members: node.members || node.member_nodes || [],
                isHyper: true,
                // Dynamic chemical hypernode colors
                bgColor: hexToRgba(hypernodeColors.chemical, hypernodeTransparency.chemical),
                borderColor: hexToRgba(hypernodeColors.chemical, Math.min(hypernodeTransparency.chemical + 0.3, 1.0)),
                borderStyle: 'dashed',
                legendColor: '#9CA3AF'
              },
              position: undefined,
              classes: 'hypernode hypernode-chemical'
            });
          } else {
            nodes.push({
              data: {
                id: node.id,
                label: node.label || node.id,
                type: node.type,
                parent: node.parent, // backend assigned parent to chemical-hypernode
                community: undefined,
                isHyper: false,
                ...node
              },
              position: undefined,
              classes: `base-node node-${node.type?.toLowerCase() || 'other'} ${isWOENode(node.type) ? 'woe-node' : ''}`
            });
          }
        });
      }
      
      // Build AO/MIE/KE hypernodes whenever hypergraph is enabled OR when the
      // backend sent chemical-only hypernodes so we still show biological groups.
      if (hypergraphEnabled || serverChemicalOnly) {
        // Ensure ALL nodes are grouped into type-based hypernodes
        console.log('Creating type-based hypernodes - ensuring ALL nodes are grouped');
        
        // Group nodes by their type (normalize type names)
        // Build base set for grouping: exclude chemicals and chemical-hypernodes
        const baseForGrouping = safeData.nodes.filter(node => {
          const t = (node.type || node.original_type || '').toString();
          return t !== 'chemical' && t !== 'chemical-hypernode';
        });

        const nodesByType = {};
        baseForGrouping.forEach(node => {
          let type = node.type || 'other';
          
          // Normalize type names for consistency
          if (type === 'MolecularInitiatingEvent' || type === 'MIE') {
            type = 'MolecularInitiatingEvent';
          } else if (type === 'KeyEvent' || type === 'KE') {
            type = 'KeyEvent';
          } else if (type === 'AdverseOutcome' || type === 'AO') {
            type = 'AdverseOutcome';
          }
          
          if (!nodesByType[type]) {
            nodesByType[type] = [];
          }
          nodesByType[type].push(node);
        });
        
        console.log('Nodes grouped by type:', Object.keys(nodesByType).map(type => `${type}: ${nodesByType[type].length}`).join(', '));
        
        // Create communities for each type - ALWAYS create a hypernode even for single nodes
        let allCommunities = [];
        let communityCounter = 0;
        
        Object.entries(nodesByType).forEach(([type, typeNodes]) => {
          console.log(`Processing ${type} nodes: ${typeNodes.length} total`);
          
          if (typeNodes.length <= maxNodesPerHypernode) {
            // Create single hypernode for this type (even if only 1 node)
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
        
        console.log(`Created ${allCommunities.length} hypernodes total - ALL nodes will be contained`);
        
        // Verify ALL nodes are assigned (they should be since we grouped by type above)
        const assignedNodeIds = new Set();
        allCommunities.forEach(community => {
          community.nodes.forEach(node => {
            assignedNodeIds.add(node.id);
          });
        });
        
        const unassignedNodes = baseForGrouping.filter(node => !assignedNodeIds.has(node.id));
        if (unassignedNodes.length > 0) {
          console.warn(`Found ${unassignedNodes.length} unassigned nodes - this should not happen with type-based grouping!`);
          console.warn('Unassigned nodes:', unassignedNodes.map(n => `${n.id} (${n.type})`));
          // Create individual hypernodes for any missed nodes
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
        
        console.log('Final verification: All communities and their nodes:');
        allCommunities.forEach((comm, i) => {
          console.log(`  Community ${i} (${comm.originalType}): ${comm.nodes.map(n => n.id).join(', ')}`);
        });
        
        console.log(`Total communities detected: ${allCommunities.length}`);
        allCommunities.forEach((comm, i) => {
          console.log(`Community ${i} (${comm.originalType}): ${comm.nodes.length} nodes`);
        });
        
        // Assign pastel colors per community and build color map
        const communityColorMap = new Map();
        allCommunities.forEach((community) => {
          const col = getPastelByIndex(community.globalId);
          communityColorMap.set(community.globalId, col);
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
        
        // Create individual nodes; assign AO/MIE/KE into community hypernodes,
        // but keep chemical nodes (and any server-nested nodes) as-is.
        nodes = safeData.nodes.map(node => {
          const t = (node.type || '').toString();
          if (t.toLowerCase() === 'chemical') {
            // Preserve backend-assigned parent and position for chemicals
            return {
              data: {
                ...node, // spread first, then ensure overrides
                id: node.id,
                label: node.label || node.id,
                type: 'chemical',
                parent: node.parent, // keep parent from backend (chemical-hypernode)
                community: undefined,
                isHyper: false
              },
              position: undefined,
              classes: `base-node chemical-node ${!showChemicals ? 'chemical-hidden' : ''}`
            };
          }
          
          const communityGlobalId = nodeToCommunity[node.id];
          const hypernodeId = communityGlobalId !== undefined ? `community_${communityGlobalId}` : undefined;
          
          // Calculate position within hypernode when assigned
          const position = (communityGlobalId !== undefined)
            ? calculateNodePositionInHypernode(node, communityGlobalId, allCommunities, hypernodePositions)
            : undefined;
          
          if (communityGlobalId === undefined) {
            console.warn(`No community assignment for base node ${node.id} (${node.type}); leaving ungrouped`);
          } else {
            console.log(`Node ${node.id} (${node.type}) -> parent ${hypernodeId}`);
          }
          
          return {
            data: {
              ...node, // spread first so overrides below stick
              id: node.id,
              label: node.label || node.id,
              type: node.type,
              parent: hypernodeId, // Assign to type-based hypernode (AO/MIE/KE)
              community: communityGlobalId,
              isHyper: false
            },
            position,
            classes: `base-node node-${node.type?.toLowerCase() || 'other'} ${isWOENode(node.type) ? 'woe-node' : ''}`
          };
        });
        
        console.log(`Created ${nodes.length} individual nodes, all should have parent hypernodes`);
        
        // Verify all nodes have parents
        let nodesWithoutParents = nodes.filter(n => !n.data.parent || n.data.parent.startsWith('isolated_'));
        if (nodesWithoutParents.length > 0) {
          console.warn(`Found ${nodesWithoutParents.length} nodes without parents. Applying type-based fallback hypernodes...`);
          
          // Fallback: create 1 hypernode per biological type and assign any unparented nodes to them
          const fallbackTypes = [
            { key: 'MolecularInitiatingEvent', label: 'MolecularInitiatingEvent Group', color: '#86efac' },
            { key: 'KeyEvent', label: 'KeyEvent Group', color: '#93c5fd' },
            { key: 'AdverseOutcome', label: 'AdverseOutcome Group', color: '#f9a8d4' }
          ];
          
          const createdFallbacks = new Map();
          
          fallbackTypes.forEach(ft => {
            const typeNodes = nodesWithoutParents.filter(n => (n.data.type === ft.key) ||
                                                              (ft.key === 'MolecularInitiatingEvent' && n.data.type === 'MIE') ||
                                                              (ft.key === 'KeyEvent' && n.data.type === 'KE') ||
                                                              (ft.key === 'AdverseOutcome' && n.data.type === 'AO'));
            if (typeNodes.length === 0) return;
            
            const hid = `fallback_${ft.key.toLowerCase()}`;
            // Create container if not already created
            if (!createdFallbacks.has(ft.key)) {
              hyperNodes.push({
                data: {
                  id: hid,
                  label: `${ft.label} (${typeNodes.length})`,
                  type: 'hypernode',
                  original_type: ft.key,
                  member_count: typeNodes.length,
                  member_nodes: typeNodes.map(n => n.data.id),
                  isHyper: true,
                  bgColor: hexToRgba(ft.color, 0.14),
                  borderColor: hexToRgba(ft.color, 0.45),
                  borderStyle: 'solid',
                  legendColor: ft.color
                },
                classes: `hypernode hypernode-${ft.key.toLowerCase()}`
              });
              createdFallbacks.set(ft.key, hid);
            }
            
            // Assign parent
            typeNodes.forEach(n => {
              n.data.parent = createdFallbacks.get(ft.key);
            });
          });
          
          // Refresh the missing list after fallback
          nodesWithoutParents = nodes.filter(n => !n.data.parent || n.data.parent.startsWith('isolated_'));
          if (nodesWithoutParents.length > 0) {
            console.error(`After fallback, still ${nodesWithoutParents.length} nodes without parents:`, nodesWithoutParents.map(n => `${n.data.id} (${n.data.type})`));
          } else {
            console.log('Fallback succeeded: all nodes are now assigned to hypernode parents');
          }
        } else {
          console.log('SUCCESS: All nodes have been assigned to hypernode parents');
        }
        
        // Create hypernodes for each community with better color scheme
        allCommunities.forEach((community, communityIndex) => {
          const hypernodeId = `community_${community.globalId}`;
          const dominantType = community.dominantType;
          const typeDistribution = community.typeDistribution;
          
          console.log(`Creating hypernode ${hypernodeId} for ${community.originalType} with ${community.nodes.length} members:`, community.nodes.map(n => n.id));
          
          // Create descriptive label for type-specific communities
          let label;
          if (community.isSplit) {
            label = `${community.originalType} Group ${community.splitIndex} (${community.nodes.length})`;
          } else {
            label = `${community.originalType} Group (${community.nodes.length})`;
          }
          
          // Use dynamic colors from state
          const getTypeColor = (originalType) => {
            // Normalize type names
            let normalizedType = originalType;
            if (originalType === 'MIE') normalizedType = 'MolecularInitiatingEvent';
            if (originalType === 'KE') normalizedType = 'KeyEvent';
            if (originalType === 'AO') normalizedType = 'AdverseOutcome';
            
            return hypernodeColors[normalizedType] || '#d1d5db'; // fallback to gray-300
          };
          
          const getTypeTransparency = (originalType) => {
            // Normalize type names
            let normalizedType = originalType;
            if (originalType === 'MIE') normalizedType = 'MolecularInitiatingEvent';
            if (originalType === 'KE') normalizedType = 'KeyEvent';
            if (originalType === 'AO') normalizedType = 'AdverseOutcome';
            
            return hypernodeTransparency[normalizedType] || 0.14; // fallback transparency
          };
          
          const baseCol = getTypeColor(community.originalType);
          const transparency = getTypeTransparency(community.originalType);
          const bgCol = hexToRgba(baseCol, transparency);  // dynamic transparency
          const borderCol = hexToRgba(baseCol, Math.min(transparency + 0.3, 1.0)); // slightly more opaque border
          const borderStyle = (community.originalType === 'chemical') ? 'dashed' : 'solid';
          
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
              isHyper: true,
              bgColor: bgCol,
              borderColor: borderCol,
              legendColor: baseCol,
              borderStyle
            },
            position: hypernodePositions[community.globalId], // Set preset position
            classes: `hypernode hypernode-${community.originalType.toLowerCase()}`
          });
        });
        
        console.log(`Created ${hyperNodes.length} hypernode containers for all node types`);
        
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

        // Add chemical→AO hyperedges per AOP (selected) using frontend hypernodes
        try {
          // nodeToCommunity map already built above
          const nodeToComm = nodeToCommunity;

          // Collect chemical and AO community ids per AOP
          const chemCommsByAop = new Map();
          const aoCommsByAop = new Map();

          safeData.nodes.forEach(n => {
            if (!n || !n.id) return;
            const aopId = n.aop;
            const t = (n.type || '').toString();
            const comm = nodeToComm[n.id];
            if (!aopId || comm === undefined) return;

            if (t === 'chemical') {
              if (!chemCommsByAop.has(aopId)) chemCommsByAop.set(aopId, new Set());
              chemCommsByAop.get(aopId).add(comm);
            }
            if (t === 'AdverseOutcome' || t === 'AO') {
              if (!aoCommsByAop.has(aopId)) aoCommsByAop.set(aopId, new Set());
              aoCommsByAop.get(aopId).add(comm);
            }
          });

          // Prefer friendly AOP names if backend provided them
          const aopNames =
            (hypergraphData && (hypergraphData.aop_names || hypergraphData.aop_id_to_name)) || {};

          chemCommsByAop.forEach((chemSet, aopId) => {
            const aoSet = aoCommsByAop.get(aopId);
            if (!aoSet || aoSet.size === 0) return;

            const aopNum = (aopId && aopId.includes(':')) ? aopId.split(':')[1] : (aopId || '');
            const aopLabel =
              aopNames[aopId] ? `AOP ${aopNum}: ${aopNames[aopId]}` :
              (aopNum ? `AOP ${aopNum}` : (aopId || ''));

            chemSet.forEach(srcComm => {
              aoSet.forEach(tgtComm => {
                const edgeId = `hyperedge_chem_${srcComm}_to_${tgtComm}_${aopNum}`;
                hyperEdges.push({
                  data: {
                    id: edgeId,
                    source: `community_${srcComm}`,
                    target: `community_${tgtComm}`,
                    type: 'chemical_hyperedge',
                    isHyper: true,
                    aop: aopId,
                    label: aopLabel
                  },
                  classes: `hyperedge chemical-hyperedge ${!showChemicals ? 'chemical-hidden' : ''}`
                });
              });
            });
          });
        } catch (e) {
          console.warn('Failed to add chemical→AO hyperedges:', e);
        }
        
        console.log(`Created ${hyperNodes.length} hypernodes and ${hyperEdges.length} meaningful hyperedges`);
        console.log('Hyperedge connections:', Array.from(communityConnections.values()));

        // --- Position chemical hypernodes and their children to avoid overlap ---
        try {
          const chemHyperNodes = hyperNodes.filter(h => (h.data?.original_type === 'chemical') || (h.classes || '').includes('hypernode-chemical'));
          if (chemHyperNodes.length > 0) {
            // Determine a new column to the right of existing community grid
            const existingXs = Object.values(hypernodePositions || {}).map(p => p.x);
            const xPad = 350; const yPad = 240; // tighter spacing for chemical column too
            const chemColX = (existingXs.length > 0 ? Math.max(...existingXs) + xPad : 0);

            // Helper to estimate container size used in styles
            const estimateContainer = (memberCount) => {
              const baseWidth = Math.max(140, Math.min(250, 140 + (memberCount * 5)));
              const baseHeight = Math.max(110, Math.min(200, 110 + (memberCount * 3.5)));
              return { width: baseWidth, height: baseHeight };
            };

            chemHyperNodes.forEach((h, idx) => {
              const memberCount = h.data?.member_count || (Array.isArray(h.data?.member_nodes) ? h.data.member_nodes.length : 0);
              const { width, height } = estimateContainer(memberCount);
              const center = { x: chemColX, y: (idx - (chemHyperNodes.length - 1) / 2) * yPad };
              // Place hypernode itself
              h.position = center;

              // Place child chemical nodes in a compact grid inside this container
              const children = nodes.filter(n => n?.data?.parent === h.data.id && (n.data.type === 'chemical'));
              if (children.length > 0) {
                const cols = Math.max(1, Math.ceil(Math.sqrt(children.length)));
                const rows = Math.max(1, Math.ceil(children.length / cols));
                const innerW = Math.max(60, width - 40);
                const innerH = Math.max(60, height - 40);
                const cellX = cols > 1 ? innerW / (cols - 1) : 0;
                const cellY = rows > 1 ? innerH / (rows - 1) : 0;
                const startX = center.x - innerW / 2;
                const startY = center.y - innerH / 2;

                children.forEach((child, i) => {
                  const r = Math.floor(i / cols);
                  const c = i % cols;
                  const x = startX + c * cellX;
                  const y = startY + r * cellY;
                  child.position = { x, y };
                });
              }
            });
          }
        } catch (e) {
          console.warn('Chemical hypernode positioning failed:', e);
        }
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
          classes: `base-node node-${node.type?.toLowerCase() || 'other'} ${isWOENode(node.type) ? 'woe-node' : ''}`
        }));
      }
      
      // Prepare edges
      const edges = safeData.edges.map(edge => {
        const et = (edge.type || edge.relationship || 'regular').toString();
        const isChemEdge = et.toLowerCase().includes('chemical');
        return ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: et,
            isHyper: false
          },
          classes: `base-edge ${isChemEdge ? 'chemical-edge' : ''} ${isChemEdge && !showChemicals ? 'chemical-hidden' : ''}`
        });
      });

      // Update counts only (legend removed)
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

      // Build layout options with override support
      const isComprehensive = !!(sourceGraph && sourceGraph.metadata && sourceGraph.metadata.source === 'comprehensive_search');
      const wantsForce = !!(sourceGraph && sourceGraph.metadata && sourceGraph.metadata.layout_hint === 'force');

  const buildLayoutOptions = (name) => {
    switch ((name || '').toLowerCase()) {
      case 'preset':
        return { name: 'preset', fit: true, padding: 80 };
      case 'force':
      case 'forceatlas2':
      case 'euler':
        return {
          name: 'euler',
          fit: true,
          padding: 80,
          nodeDimensionsIncludeLabels: true,
          // Compact-but-separated tuning
          springLength: 90,
          springCoeff: 0.0007,
          repulsion: 3000,
          gravity: 0.6,
          iterations: 1300,
          // Disable animation to eliminate jitter; deterministic start
          animate: false,
          animationDuration: 700,
          randomize: false
        };
      // removed unsupported layouts: cose-bilkent, cola
      case 'dagre':
        return { name: 'dagre', fit: true, padding: 80, rankDir: 'LR', nodeSep: 50, rankSep: 80 };
      case 'grid':
        return { name: 'grid', fit: true, padding: 80 };
      case 'circle':
        return { name: 'circle', fit: true, padding: 80 };
      case 'concentric':
        return { name: 'concentric', fit: true, padding: 80 };
      case 'breadthfirst':
        return { name: 'breadthfirst', fit: true, padding: 80, directed: true, circle: false };
      default:
        // Auto behavior for hypergraph:
        // - comprehensive_search → Preset (columnar hypernodes like screenshots)
        // - else if layout_hint requests force → Euler
        // - else → Preset
        if (hypergraphEnabled) {
          if (isComprehensive) return buildLayoutOptions('preset');
          if (wantsForce) return buildLayoutOptions('euler');
          return buildLayoutOptions('preset');
        }
        // Non-hypergraph fallback (not typically used here)
        return {
          name: layoutType === 'forceatlas2' ? 'euler' : layoutType,
          fit: true,
          padding: 80,
          nodeDimensionsIncludeLabels: true,
          uniformNodeDimensions: false,
          packComponents: true,
          nodeRepulsion: 4500,
          idealEdgeLength: 150,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.05,
          numIter: 2200,
          tile: true,
          animate: true,
          animationDuration: 600,
          randomize: false,
          tilingPaddingVertical: 20,
          tilingPaddingHorizontal: 20
        };
    }
  };

      const chosenLayoutName = (layoutOverride && layoutOverride !== 'auto') ? layoutOverride : 'auto';
      const layoutOptions = buildLayoutOptions(chosenLayoutName);

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
          // Individual node styling - solid shapes with strong contrast
          {
            selector: 'node',
            style: {
              'width': (node) => getNodeSize(node.data('id')),
              'height': (node) => getNodeSize(node.data('id')),
              'background-color': (node) => {
                const type = node.data('type');
                const isSelected = node.data('is_selected');
                const isWOE = isWOENode(type);
                
                if (isSelected) {
                  if (type === 'MolecularInitiatingEvent' || type === 'MIE') return NODE_COLORS.MIE.selected;
                  if (type === 'KeyEvent' || type === 'KE') return NODE_COLORS.KE.selected;
                  if (type === 'AdverseOutcome' || type === 'AO') return NODE_COLORS.AO.selected;
                  if (isWOE) return NODE_COLORS.WOE.selected;
                  return NODE_COLORS.OTHER.selected;
                } else {
                  if (type === 'MolecularInitiatingEvent' || type === 'MIE') return NODE_COLORS.MIE.normal;
                  if (type === 'KeyEvent' || type === 'KE') return NODE_COLORS.KE.normal;
                  if (type === 'AdverseOutcome' || type === 'AO') return NODE_COLORS.AO.normal;
                  if (isWOE) return NODE_COLORS.WOE.normal;
                  return NODE_COLORS.OTHER.normal;
                }
              },
              'background-opacity': 1,
              'border-width': (node) => node.data('is_selected') ? 3 : 2,
              'border-color': (node) => node.data('is_selected') ? '#000000' : '#374151',
              'shape': (node) => {
                const type = node.data('type');
                if (type === 'MolecularInitiatingEvent' || type === 'MIE') return 'triangle';
                if (type === 'KeyEvent' || type === 'KE') return 'rectangle';
                if (type === 'AdverseOutcome' || type === 'AO') return 'ellipse';
                return 'roundrectangle';
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
              'z-index': 10
            }
          },
          // Hidden chemical nodes/hypernodes when toggled off
          {
            selector: '.chemical-hidden',
            style: {
              'display': 'none'
            }
          },
          // WOE nodes - distinct border/shape
          {
            selector: 'node.woe-node',
            style: {
              'border-style': 'dashed',
              'border-color': '#a855f7',
              'border-width': 2,
              'shape': 'diamond'
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
          // Hypernode compound styling - solid rectangular containers with higher contrast
          {
            selector: '.hypernode',
            style: {
              'background-color': (node) => node.data('bgColor') || 'rgba(229, 231, 235, 1)',
              'border-width': 3,
              'border-color': (node) => node.data('borderColor') || '#374151',
              'border-style': (node) => node.data('borderStyle') || 'solid',
              'shape': 'roundrectangle', // Rounded rectangular containers
              'label': 'data(label)',
              'font-size': '14px', // Larger, more readable font
              'font-weight': 'bold', // Bold for clear hierarchy
              'color': '#374151', // Darker text for better readability
              'text-valign': 'top',
              'text-halign': 'center',
              'text-margin-x': 0,
              'text-margin-y': '-10px', // Position label at the top
              'text-background-opacity': 0,
              'padding': '10px', // Smaller padding for compact hypernodes
              'width': (node) => {
                const memberCount = node.data('member_count') || 1;
                const originalType = node.data('original_type') || '';
                
                // Larger sizing for chemical hypernodes to prevent overlap
                if (originalType === 'chemical') {
                  const baseWidth = Math.max(160, Math.min(260, 160 + (memberCount * 8)));
                  return `${baseWidth}px`;
                } else {
                  // Standard sizing for biological hypernodes
                  const baseWidth = Math.max(140, Math.min(220, 140 + (memberCount * 6)));
                  return `${baseWidth}px`;
                }
              },
              'height': (node) => {
                const memberCount = node.data('member_count') || 1;
                const originalType = node.data('original_type') || '';
                
                // Larger sizing for chemical hypernodes to prevent overlap
                if (originalType === 'chemical') {
                  const baseHeight = Math.max(130, Math.min(210, 130 + (memberCount * 6)));
                  return `${baseHeight}px`;
                } else {
                  // Standard sizing for biological hypernodes
                  const baseHeight = Math.max(110, Math.min(180, 110 + (memberCount * 5)));
                  return `${baseHeight}px`;
                }
              },
              'z-index': 0, // Behind individual nodes
              'opacity': 0.95 // More visible for clean organization
            }
          },
          // Chemical node styling
          {
            selector: 'node[type="chemical"], node.chemical-node',
            style: {
              'background-color': '#fbbf24', // amber-400 for chemicals
              'border-width': 1,
              'border-color': '#f59e0b', // amber-500 border
              'color': '#92400e', // amber-800 text
              'font-size': '10px',
              'font-weight': 'bold',
              'shape': 'diamond', // Distinct shape for chemicals
              'width': '30px',
              'height': '30px',
              'text-valign': 'center',
              'text-halign': 'center',
              'z-index': 10
            }
          },
          // Chemical connection edge styling
          {
            selector: 'edge[type="chemical_connection"]',
            style: {
              'width': 2,
              'line-color': '#f59e0b', // amber-500 to match chemical nodes
              'line-style': 'dotted',
              'opacity': 0.8,
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#f59e0b',
              'arrow-scale': 0.8,
              'z-index': 8,
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#92400e', // amber-800 for edge labels
            'text-background-opacity': 0
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
              'arrow-scale': 1.0,
              // Show labels on hyperedges (e.g., "AOP 315: <name>")
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#374151',
            'text-background-opacity': 0
          }
        },
          // Faded elements (non-path)
          {
            selector: '.faded',
            style: {
              'opacity': 0.12,
              'text-opacity': 0.12
            }
          },
          {
            selector: 'edge.faded',
            style: {
              'width': 1
            }
          },
          // Highlighted elements (path)
          {
            selector: '.highlighted',
            style: {
              'opacity': 1,
              'text-opacity': 1,
              'z-index': 25
            }
          },
          {
            selector: 'node.highlighted',
            style: {
              'border-width': 3,
              'border-color': '#111827',
              'background-color': (node) => {
                const type = node.data('type');
                const isWOE = isWOENode(type);
                if (type === 'MolecularInitiatingEvent' || type === 'MIE') return NODE_COLORS.MIE.selected;
                if (type === 'KeyEvent' || type === 'KE') return NODE_COLORS.KE.selected;
                if (type === 'AdverseOutcome' || type === 'AO') return NODE_COLORS.AO.selected;
                if (isWOE) return NODE_COLORS.WOE.selected;
                return NODE_COLORS.OTHER.selected;
              },
              'background-opacity': 1
            }
          },
          {
            selector: 'edge.highlighted',
            style: {
              'width': 3,
              'line-color': '#111827',
              'target-arrow-color': '#111827',
              'opacity': 1,
              'z-index': 15
            }
          },
          {
            selector: '.hypernode.highlighted',
            style: {
              'opacity': 1,
              'border-width': 1.5
            }
          },
          {
            selector: '.hypernode.faded',
            style: {
              'opacity': 0.18
            }
          },
          // Selected node styling
          {
            selector: '.selected',
            style: {
              'border-width': 4,
              'border-color': '#ef4444',
              'z-index': 20
            }
          }
  ],
  layout: layoutOptions
      });

      // Preset positioning is already applied via node.position property

      // Helper: Pack visible children inside each hypernode on a clean grid with guaranteed no overlap
      const packChildrenInParents = (cyInst) => {
        try {
          const parents = cyInst.nodes(':parent:visible');
          if (parents.length === 0) return;
          cyInst.startBatch();
          parents.forEach((parent) => {
            const children = parent.children(':visible');
            if (children.length === 0) return;

            // Determine inner area based on explicit width/height of the hypernode
            const innerPadX = 10; // match style padding
            const innerPadY = 10;
            const parentWidth = Math.max(parent.width(), parent.boundingBox().w) - innerPadX * 2;
            const parentHeight = Math.max(parent.height(), parent.boundingBox().h) - innerPadY * 2;
            const center = parent.position();

            // Compute max child dimensions to set cell size
            let maxW = 0, maxH = 0;
            children.forEach((ch) => {
              maxW = Math.max(maxW, ch.width());
              maxH = Math.max(maxH, ch.height());
            });
            const cellW = Math.max(30, Math.ceil(maxW) + 16); // add buffer to avoid touching
            const cellH = Math.max(30, Math.ceil(maxH) + 14);

            const cols = Math.max(1, Math.floor(parentWidth / cellW));
            const rows = Math.max(1, Math.ceil(children.length / cols));

            // Ensure grid fits within parent bounds
            const gridW = Math.min(cols * cellW, parentWidth);
            const gridH = Math.min(rows * cellH, parentHeight);

            const startX = center.x - gridW / 2 + cellW / 2;
            const startY = center.y - gridH / 2 + cellH / 2;

            children.forEach((ch, idx) => {
              const r = Math.floor(idx / cols);
              const c = idx % cols;
              const x = startX + c * cellW;
              const y = startY + r * cellH;
              ch.position({ x, y });
            });
          });
          cyInst.endBatch();
        } catch (e) {
          console.warn('Failed to pack children in parents:', e);
        }
      };

      // Add event listeners
      cytoscapeInstance.on('tap', 'node', (evt) => {
        const node = evt.target;
        console.log('Node clicked:', node.data());
        if (onNodeSelect) {
          onNodeSelect(node.data());
        }
        // Apply pathway highlighting
        applyHighlightForNode(cytoscapeInstance, node.id());
      });

      // Right-click (contextmenu) on AO or type-hypernode: show menu to reveal chemicals for that AOP
      cytoscapeInstance.on('cxttap', 'node', (evt) => {
        const node = evt.target;
        const nd = node.data() || {};
        const ntype = (nd.type || '').toString();
        const aopId = nd.aop || nd.aop_source || nd.aop_id || '';
        // Only respond for AO nodes or community hypernodes containing AOs
        const isAO = ntype === 'AdverseOutcome' || ntype === 'AO';
        const isTypeHyper = node.hasClass('hypernode') && ((nd.original_type || '').toString().toLowerCase().includes('adverseoutcome'));
        if (!isAO && !isTypeHyper) return;
        const rp = evt.renderedPosition || { x: 0, y: 0 };
        const rect = containerRef.current?.getBoundingClientRect();
        let menuX = rp.x + 8;
        let menuY = rp.y + 8;
        if (rect) {
          const maxX = rect.width - 180; // menu width cap
          const maxY = rect.height - 80; // menu height cap
          menuX = Math.max(6, Math.min(menuX, maxX));
          menuY = Math.max(6, Math.min(menuY, maxY));
        }
        setCtxMenu({ visible: true, x: menuX, y: menuY, aopId, label: nd.label || 'AOP' });
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
          // Clicked on background
          onNodeSelect && onNodeSelect(null);
          onEdgeSelect && onEdgeSelect(null);
          clearHighlights(cytoscapeInstance);
        }
      });

      setCy(cytoscapeInstance);
      cyRef.current = cytoscapeInstance;

      // Initial child packing to guarantee no overlap inside hypernodes
      setTimeout(() => packChildrenInParents(cytoscapeInstance), 50);

      // Resolve residual overlaps after layout completes (hypernodes only), then re-pack children
      cytoscapeInstance.on('layoutstop', () => {
        try {
          // Only adjust compound parent nodes to avoid moving inner children
          const nodes = cytoscapeInstance.nodes(':parent:visible');
          if (nodes.length < 2) return;
          const passes = 4; // balanced passes for separation without visible jitter
          cytoscapeInstance.startBatch();
          for (let k = 0; k < passes; k++) {
            let moved = false;
            nodes.forEach((n1, i) => {
              const b1 = n1.boundingBox({ includeLabels: true });
              const c1x = (b1.x1 + b1.x2) / 2;
              const c1y = (b1.y1 + b1.y2) / 2;
              nodes.forEach((n2, j) => {
                if (i >= j) return;
                const b2 = n2.boundingBox({ includeLabels: true });
                const c2x = (b2.x1 + b2.x2) / 2;
                const c2y = (b2.y1 + b2.y2) / 2;
                const ox = Math.min(b1.x2, b2.x2) - Math.max(b1.x1, b2.x1);
                const oy = Math.min(b1.y2, b2.y2) - Math.max(b1.y1, b2.y1);
                // Add small margin to treat near-touching as overlap
                if (ox > -10 && oy > -10) {
                  const pushScale = 0.5; // moderate push to avoid visible jumps
                  const pushX = (c1x < c2x ? -1 : 1) * (Math.max(ox, 0) + 4) * pushScale;
                  const pushY = (c1y < c2y ? -1 : 1) * (Math.max(oy, 0) + 4) * pushScale;
                  const p1 = n1.position();
                  const p2 = n2.position();
                  n1.position({ x: p1.x + pushX, y: p1.y + pushY });
                  n2.position({ x: p2.x - pushX, y: p2.y - pushY });
                  moved = true;
                }
              });
            });
            if (!moved) break;
          }
          cytoscapeInstance.endBatch();
          // Avoid additional fit/center to prevent sudden reflows
          // Re-pack children to guarantee no overlap inside hypernodes
          packChildrenInParents(cytoscapeInstance);
        } catch (err) {
          console.warn('Hypergraph collision resolution error:', err);
        }
      });

      // Apply initial chemical visibility (default hidden)
      try {
        if (!showChemicals) {
          cytoscapeInstance.startBatch();
          cytoscapeInstance.nodes('node[type = "chemical"]').addClass('chemical-hidden');
          cytoscapeInstance.nodes('.hypernode-chemical').addClass('chemical-hidden');
          cytoscapeInstance.edges('.chemical-hyperedge').addClass('chemical-hidden');
          cytoscapeInstance.endBatch();
        }
      } catch (e) {
        console.warn('Failed to apply initial chemical visibility:', e);
      }

      // Save initial positions for restoring when switching back to preset
      try {
        initialPositionsRef.current = {};
        cytoscapeInstance.nodes().forEach(n => {
          initialPositionsRef.current[n.id()] = { x: n.position('x'), y: n.position('y') };
        });
      } catch (e) {
        console.warn('Failed to snapshot initial positions:', e);
      }

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
  }, [data, hypergraphData, layoutType, hypergraphEnabled, maxNodesPerHypernode, communityMethod, nodeSizingMode, baseNodeSize, fontSize]);

  // Helper: reveal chemicals for a given AOP ID
  const revealChemicalsForAOP = (aopId) => {
    if (!aopId || !cyRef.current) return;
    const inst = cyRef.current;
    inst.startBatch();
    inst.nodes('node[type = "chemical"]').forEach(n => {
      if ((n.data('aop') || n.data('aop_source') || '') === aopId) {
        n.removeClass('chemical-hidden');
        const parentId = n.data('parent');
        if (parentId) {
          const p = inst.getElementById(parentId);
          p && p.removeClass('chemical-hidden');
        }
      }
    });
    inst.edges('.chemical-hyperedge').forEach(e => {
      if ((e.data('aop') || '') === aopId) e.removeClass('chemical-hidden');
    });
    inst.endBatch();
    setShowChemicals(true);
  };

  // Close context menu on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setCtxMenu((m) => ({ ...m, visible: false }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleMenuAction = () => {
    if (ctxMenu.aopId) revealChemicalsForAOP(ctxMenu.aopId);
    setCtxMenu((m) => ({ ...m, visible: false }));
  };
  

  // Additional effect to handle data changes without full re-initialization
  useEffect(() => {
    if (!cy || !data) return;
    
    console.log('HypergraphNetworkGraph: Data changed, updating elements dynamically');
    
    // If we have a cytoscape instance and new data comes in, we can update incrementally
    // But for hypergraph mode, it's often better to do a full re-initialization
    // because community detection and hypernode creation is complex
    
    // This effect will naturally trigger the main useEffect above due to data dependency
    
  }, [data?.nodes?.length, data?.edges?.length, hypergraphData?.nodes?.length]);

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

  // React to selectedNode changes by applying pathway highlight
  useEffect(() => {
    if (!cy) return;
    if (!selectedNode || !selectedNode.id) {
      clearHighlights(cy);
      return;
    }
    applyHighlightForNode(cy, selectedNode.id);
  }, [cy, selectedNode]);

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

  // Update hypernode colors and transparency dynamically
  useEffect(() => {
    if (!cy) return;

    try {
      cy.startBatch();
      
      // Update hypernode styles with new colors and transparency
      cy.nodes('.hypernode').forEach(hypernode => {
        try {
          const originalType = hypernode.data('original_type');
          if (originalType) {
            // Normalize type names
            let normalizedType = originalType;
            if (originalType === 'MIE') normalizedType = 'MolecularInitiatingEvent';
            if (originalType === 'KE') normalizedType = 'KeyEvent';
            if (originalType === 'AO') normalizedType = 'AdverseOutcome';
            
            const baseColor = hypernodeColors[normalizedType] || '#d1d5db';
            const transparency = hypernodeTransparency[normalizedType] || 0.14;
            const bgColor = hexToRgba(baseColor, transparency);
            const borderColor = hexToRgba(baseColor, Math.min(transparency + 0.3, 1.0));
            
            hypernode.style({
              'background-color': bgColor,
              'border-color': borderColor
            });
          }
        } catch (nodeError) {
          console.warn('Error updating hypernode style:', nodeError);
        }
      });
      
      cy.endBatch();
      console.log('Updated hypernode colors and transparency');
    } catch (error) {
      console.error('Error in hypernode style update:', error);
    }

  }, [cy, hypernodeColors, hypernodeTransparency]);

  // Re-run layout when layoutOverride changes
  useEffect(() => {
    if (!cy) return;
    try {
      const name = (layoutOverride || 'auto').toLowerCase();
      // Helper to construct options (mirror of builder above)
      const make = (n) => {
        switch ((n || '').toLowerCase()) {
          case 'preset': return { name: 'preset', fit: true, padding: 80 };
          case 'force':
          case 'forceatlas2':
          case 'euler':
            return { name: 'euler', fit: true, padding: 80, nodeDimensionsIncludeLabels: true, springLength: 90, springCoeff: 0.0007, repulsion: 3000, gravity: 0.6, iterations: 1300, animate: false, randomize: false };
          // removed unsupported layouts: cose-bilkent, cola
          case 'dagre': return { name: 'dagre', fit: true, padding: 80, rankDir: 'LR', nodeSep: 50, rankSep: 80 };
          case 'grid': return { name: 'grid', fit: true, padding: 80 };
          case 'circle': return { name: 'circle', fit: true, padding: 80 };
          case 'concentric': return { name: 'concentric', fit: true, padding: 80 };
          case 'breadthfirst': return { name: 'breadthfirst', fit: true, padding: 80, directed: true, circle: false };
          case 'auto':
          default: {
            // Auto: prefer Preset for comprehensive_search in hypergraph; otherwise honor force hint
            const sg = (hypergraphEnabled && hypergraphData && hypergraphData.metadata) ? hypergraphData : data;
            const isComprehensive = !!(sg && sg.metadata && sg.metadata.source === 'comprehensive_search');
            const wantsForce = !!(sg && sg.metadata && sg.metadata.layout_hint === 'force');
            if (isComprehensive) return make('preset');
            if (wantsForce) return make('euler');
            return make('preset');
          }
        }
      };

      if (name === 'preset') {
        // Restore saved preset positions if available
        if (initialPositionsRef.current && Object.keys(initialPositionsRef.current).length) {
          cy.startBatch();
          cy.nodes().forEach(n => {
            const p = initialPositionsRef.current[n.id()];
            if (p) n.position(p);
          });
          cy.endBatch();
        }
      }

      let layout;
      try {
        layout = cy.layout(make(name));
        layout.run();
      } catch (err) {
        console.warn('Layout run failed, falling back to preset:', err);
        // Fallback to preset positions to avoid blank graph
        if (initialPositionsRef.current && Object.keys(initialPositionsRef.current).length) {
          cy.startBatch();
          cy.nodes().forEach(n => {
            const p = initialPositionsRef.current[n.id()];
            if (p) n.position(p);
          });
          cy.endBatch();
        }
        const fallback = cy.layout({ name: 'preset', fit: true, padding: 80 });
        fallback.run();
      }
    } catch (e) {
      console.warn('Failed to re-run layout:', e);
    }
  }, [cy, layoutOverride, hypergraphEnabled, hypergraphData, data]);

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-gray-50 via-white to-slate-50 overflow-hidden" onClick={() => ctxMenu.visible && setCtxMenu(m => ({ ...m, visible: false }))}>
      <div className="absolute top-2 left-2 z-20 bg-white rounded-lg shadow-md max-w-sm">
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
        {/* Layout selector (trimmed to essentials) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Layout</label>
                <select
                  value={layoutOverride}
                  onChange={(e) => setLayoutOverride(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
          <option value="euler">Force (Euler)</option>
                </select>
              </div>
              {/* Chemical visibility */}
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={showChemicals}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowChemicals(checked);
                    if (!cyRef.current) return;
                    const inst = cyRef.current;
                    inst.startBatch();
                    // Toggle class on chemical nodes, chemical hypernodes, and chemical hyperedges
                    const chemNodes = inst.nodes('node.chemical-node, node[type = "chemical"]');
                    const chemHyper = inst.nodes('.hypernode-chemical');
                    const chemEdges = inst.edges('.chemical-hyperedge, .chemical-edge');
                    if (checked) {
                      chemNodes.removeClass('chemical-hidden');
                      chemHyper.removeClass('chemical-hidden');
                      chemEdges.removeClass('chemical-hidden');
                    } else {
                      chemNodes.addClass('chemical-hidden');
                      chemHyper.addClass('chemical-hidden');
                      chemEdges.addClass('chemical-hidden');
                    }
                    inst.endBatch();
                  }}
                />
                Show chemicals
              </label>
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
              
              {/* Hypernode Color Controls */}
              {hypergraphEnabled && (
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">Hypernode Colors</label>
                    <button
                      onClick={() => setShowColorControls(!showColorControls)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {showColorControls ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {showColorControls && (
                    <div className="space-y-2">
                      {/* MIE Controls */}
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: hypernodeColors.MolecularInitiatingEvent }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">MIE</label>
                          <input
                            type="color"
                            value={hypernodeColors.MolecularInitiatingEvent}
                            onChange={(e) => setHypernodeColors(prev => ({
                              ...prev,
                              MolecularInitiatingEvent: e.target.value
                            }))}
                            className="w-full h-6 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={hypernodeTransparency.MolecularInitiatingEvent}
                            onChange={(e) => setHypernodeTransparency(prev => ({
                              ...prev,
                              MolecularInitiatingEvent: parseFloat(e.target.value)
                            }))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                          />
                          <div className="text-xs text-gray-500">
                            Opacity: {Math.round(hypernodeTransparency.MolecularInitiatingEvent * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* KE Controls */}
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: hypernodeColors.KeyEvent }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">KE</label>
                          <input
                            type="color"
                            value={hypernodeColors.KeyEvent}
                            onChange={(e) => setHypernodeColors(prev => ({
                              ...prev,
                              KeyEvent: e.target.value
                            }))}
                            className="w-full h-6 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={hypernodeTransparency.KeyEvent}
                            onChange={(e) => setHypernodeTransparency(prev => ({
                              ...prev,
                              KeyEvent: parseFloat(e.target.value)
                            }))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                          />
                          <div className="text-xs text-gray-500">
                            Opacity: {Math.round(hypernodeTransparency.KeyEvent * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* AO Controls */}
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: hypernodeColors.AdverseOutcome }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">AO</label>
                          <input
                            type="color"
                            value={hypernodeColors.AdverseOutcome}
                            onChange={(e) => setHypernodeColors(prev => ({
                              ...prev,
                              AdverseOutcome: e.target.value
                            }))}
                            className="w-full h-6 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={hypernodeTransparency.AdverseOutcome}
                            onChange={(e) => setHypernodeTransparency(prev => ({
                              ...prev,
                              AdverseOutcome: parseFloat(e.target.value)
                            }))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                          />
                          <div className="text-xs text-gray-500">
                            Opacity: {Math.round(hypernodeTransparency.AdverseOutcome * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Chemical Controls */}
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: hypernodeColors.chemical }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">Chemical</label>
                          <input
                            type="color"
                            value={hypernodeColors.chemical}
                            onChange={(e) => setHypernodeColors(prev => ({
                              ...prev,
                              chemical: e.target.value
                            }))}
                            className="w-full h-6 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={hypernodeTransparency.chemical}
                            onChange={(e) => setHypernodeTransparency(prev => ({
                              ...prev,
                              chemical: parseFloat(e.target.value)
                            }))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                          />
                          <div className="text-xs text-gray-500">
                            Opacity: {Math.round(hypernodeTransparency.chemical * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Reset Button */}
                      <button
                        onClick={() => {
                          setHypernodeColors({
                            MolecularInitiatingEvent: '#86efac',
                            KeyEvent: '#93c5fd',
                            AdverseOutcome: '#f9a8d4',
                            chemical: '#9CA3AF'
                          });
                          setHypernodeTransparency({
                            MolecularInitiatingEvent: 0.14,
                            KeyEvent: 0.14,
                            AdverseOutcome: 0.14,
                            chemical: 0.18
                          });
                        }}
                        className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-300 mt-2"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend Panel - Removed per user request */}
      
      {/* Subtle background pattern for visual depth */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(156,163,175,0.08)_1px,transparent_0)] bg-[length:30px_30px]"></div>
      </div>
      
      {/* Context menu overlay */}
      {ctxMenu.visible && (
        <div
          style={{
            position: 'absolute',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 50,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 200,
            padding: 4
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '6px 10px', fontSize: 12, color: '#6b7280' }}>
            AOP: {ctxMenu.label || ctxMenu.aopId}
          </div>
          <button
            onClick={handleMenuAction}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Show chemicals for this AOP
          </button>
        </div>
      )}

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
