import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, Download, Settings, Layers } from 'lucide-react';

// Register the layout extensions
cytoscape.use(coseBilkent);

const NetworkGraph = ({ 
  data, 
  onNodeSelect, 
  onEdgeSelect, 
  selectedNode, 
  selectedEdge,
  theme = 'light',
  searchPanelRef
}) => {
  // Refs
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const layoutTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Core state
  const [cy, setCy] = useState(null);
  const [layoutName, setLayoutName] = useState('cose-bilkent');
  const [layerDirection, setLayerDirection] = useState('vertical');
  const [nodeCount, setNodeCount] = useState(0);
  const [isLargeGraph, setIsLargeGraph] = useState(false);
  
  // Node visualization controls
  const [nodeSize, setNodeSize] = useState(20);
  const [fontSize, setFontSize] = useState(8);
  const [betweennessCentrality, setBetweennessCentrality] = useState(null);

  // Export functions
  const exportAsPNG = () => {
    if (!cy) return;
    
    // Temporarily apply high-quality export styles that respect current settings
    const originalNodeSize = nodeSize || 20;
    const originalFontSize = fontSize || 8;
    const exportNodeSize = Math.max(originalNodeSize * 1.5, 24); // Larger for export
    const exportFontSize = Math.max(originalFontSize * 1.5, 12); // Larger for export
    
    // Apply temporary export-optimized styles
    cy.style()
      .selector('node:not(.hypernode-bg)')
      .style({
        'width': exportNodeSize,
        'height': exportNodeSize,
        'font-size': `${exportFontSize}px`,
        'font-weight': 'bold',
        'text-outline-width': 2,
        'text-outline-color': '#ffffff',
        'border-width': 2
      })
      .update();
    
    // Generate high-quality PNG
    setTimeout(() => {
      const png64 = cy.png({
        output: 'base64uri',
        bg: theme === 'dark' ? '#1f2937' : '#ffffff',
        full: true,
        scale: 3, // Higher resolution
        maxWidth: 4000,
        maxHeight: 4000
      });
      
      const link = document.createElement('a');
      link.download = `aop-network-${Date.now()}.png`;
      link.href = png64;
      link.click();
      
      // Restore original styles
      setTimeout(() => {
        cy.style()
          .selector('node:not(.hypernode-bg)')
          .style(getOptimizedNodeStyle(isLargeGraph, betweennessCentrality, originalNodeSize))
          .update();
      }, 100);
    }, 100);
  };

  // Custom layered layout function
  const applyLayeredLayout = (cytoscapeInstance, direction = 'vertical') => {
    if (!cytoscapeInstance) {
      console.error('No cytoscape instance available');
      return;
    }

    const nodes = cytoscapeInstance.nodes();
    if (nodes.length === 0) {
      console.warn('No nodes to layout');
      return;
    }

    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 600;
    
    console.log('Applying layered layout:', { 
      direction, 
      containerWidth, 
      containerHeight, 
      nodeCount: nodes.length 
    });
    
    // Group nodes by type - get actual node types from data
    const allNodes = nodes.toArray();
    const nodesByType = {
      MIE: [],
      KE: [],
      AO: [],
      Other: []
    };

    allNodes.forEach(node => {
      const nodeType = node.data('type');
      console.log(`Node ${node.data('label')} has type: ${nodeType}`);
      
      if (nodeType === 'MolecularInitiatingEvent') {
        nodesByType.MIE.push(node);
      } else if (nodeType === 'KeyEvent') {
        nodesByType.KE.push(node);
      } else if (nodeType === 'AdverseOutcome') {
        nodesByType.AO.push(node);
      } else {
        nodesByType.Other.push(node);
      }
    });
    
    console.log('Node distribution:', {
      MIE: nodesByType.MIE.length,
      KE: nodesByType.KE.length,
      AO: nodesByType.AO.length,
      Other: nodesByType.Other.length
    });
    
    // Create layers - add Other nodes to KE layer
    const layers = [
      { nodes: nodesByType.MIE, label: 'MIE (Layer 1)' },
      { nodes: [...nodesByType.KE, ...nodesByType.Other], label: 'KE (Layer 2)' },
      { nodes: nodesByType.AO, label: 'AO (Layer 3)' }
    ];
    
    const padding = 80;
    const minLayerGap = 200;
    
    // Calculate available space and layer positions
    const totalLayers = layers.filter(layer => layer.nodes.length > 0).length;
    let layerPositions = [];
    
    if (direction === 'vertical') {
      const availableHeight = containerHeight - (2 * padding);
      const layerGap = Math.max(minLayerGap, availableHeight / Math.max(1, totalLayers - 1));
      
      let activeLayerIndex = 0;
      layers.forEach((layer, layerIndex) => {
        if (layer.nodes.length > 0) {
          layerPositions[layerIndex] = padding + (activeLayerIndex * layerGap);
          activeLayerIndex++;
        }
      });
    } else {
      const availableWidth = containerWidth - (2 * padding);
      const layerGap = Math.max(minLayerGap, availableWidth / Math.max(1, totalLayers - 1));
      
      let activeLayerIndex = 0;
      layers.forEach((layer, layerIndex) => {
        if (layer.nodes.length > 0) {
          layerPositions[layerIndex] = padding + (activeLayerIndex * layerGap);
          activeLayerIndex++;
        }
      });
    }
    
    // Position nodes in each layer
    layers.forEach((layer, layerIndex) => {
      const nodeCount = layer.nodes.length;
      if (nodeCount === 0) return;
      
      console.log(`Processing ${layer.label} with ${nodeCount} nodes`);
      
      layer.nodes.forEach((node, nodeIndex) => {
        let x, y;
        
        if (direction === 'vertical') {
          y = layerPositions[layerIndex];
          
          if (nodeCount === 1) {
            x = containerWidth / 2;
          } else {
            const layerWidth = containerWidth - (2 * padding);
            const spacing = layerWidth / (nodeCount + 1); // +1 for better spacing
            x = padding + ((nodeIndex + 1) * spacing);
          }
        } else {
          x = layerPositions[layerIndex];
          
          if (nodeCount === 1) {
            y = containerHeight / 2;
          } else {
            const layerHeight = containerHeight - (2 * padding);
            const spacing = layerHeight / (nodeCount + 1); // +1 for better spacing
            y = padding + ((nodeIndex + 1) * spacing);
          }
        }
        
        console.log(`Positioning ${node.data('label')} at (${Math.round(x)}, ${Math.round(y)})`);
        
        // Animate to new position
        node.animate({
          position: { x: Math.round(x), y: Math.round(y) }
        }, {
          duration: 1000,
          easing: 'ease-out'
        });
      });
    });
    
    // Fit view after animation
    setTimeout(() => {
      cytoscapeInstance.fit(cytoscapeInstance.nodes(), 50);
    }, 1200);
  };

  // Helper function to find connected components within a set of nodes
  const findConnectedComponents = (nodes, cytoscapeInstance) => {
    console.log('Finding connected components for', nodes.length, 'nodes');
    
    if (nodes.length <= 1) {
      return [nodes];
    }
    
    const visited = new Set();
    const components = [];
    
    const dfs = (startNode, component) => {
      if (visited.has(startNode.id())) return;
      visited.add(startNode.id());
      component.push(startNode);
      
      // Find all connected neighbors within the same node set
      const neighbors = startNode.connectedEdges().connectedNodes();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor.id()) && nodes.some(n => n.id() === neighbor.id())) {
          dfs(neighbor, component);
        }
      });
    };
    
    nodes.forEach(node => {
      if (!visited.has(node.id())) {
        const component = [];
        dfs(node, component);
        if (component.length > 0) {
          components.push(component);
        }
      }
    });
    
    console.log(`Found ${components.length} connected components with sizes:`, components.map(c => c.length));
    
    // If we get one large component (> 70% of nodes), try to split it further
    if (components.length === 1 && components[0].length > nodes.length * 0.7 && nodes.length > 4) {
      console.log('Large connected component detected, attempting to split by node degree');
      return splitLargeComponent(components[0], cytoscapeInstance);
    }
    
    return components;
  };

  // Helper function to split large connected components by node degree or clustering
  const splitLargeComponent = (nodes, cytoscapeInstance) => {
    console.log('Splitting large component of', nodes.length, 'nodes');
    
    // Calculate node degrees within this component
    const nodeDegrees = new Map();
    nodes.forEach(node => {
      const edges = node.connectedEdges().filter(edge => {
        const otherNode = edge.otherNode(node);
        return nodes.some(n => n.id() === otherNode.id());
      });
      nodeDegrees.set(node.id(), edges.length);
    });
    
    // Sort nodes by degree
    const sortedNodes = [...nodes].sort((a, b) => 
      (nodeDegrees.get(b.id()) || 0) - (nodeDegrees.get(a.id()) || 0)
    );
    
    // Split into smaller groups based on connectivity patterns
    const targetGroupSize = Math.max(2, Math.floor(nodes.length / 3));
    const groups = [];
    let currentGroup = [];
    
    sortedNodes.forEach((node, index) => {
      currentGroup.push(node);
      
      // Start new group when current group reaches target size
      // or when there's a significant degree drop
      if (currentGroup.length >= targetGroupSize || 
          (index < sortedNodes.length - 1 && 
           (nodeDegrees.get(node.id()) || 0) > (nodeDegrees.get(sortedNodes[index + 1].id()) || 0) * 2)) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
    });
    
    // Add remaining nodes to last group
    if (currentGroup.length > 0) {
      if (groups.length > 0) {
        groups[groups.length - 1].push(...currentGroup);
      } else {
        groups.push(currentGroup);
      }
    }
    
    console.log(`Split large component into ${groups.length} groups with sizes:`, groups.map(g => g.length));
    return groups.filter(group => group.length > 0);
  };

  // Helper function to force split small groups to prevent single large clusters
  const forceSplitSmallGroup = (nodes, cytoscapeInstance) => {
    console.log('Force splitting small group of', nodes.length, 'nodes');
    
    if (nodes.length <= 2) {
      return nodes.map(node => [node]);
    }
    
    // For small groups, split roughly in half based on connectivity
    const targetGroups = Math.min(nodes.length, Math.max(2, Math.floor(nodes.length / 2)));
    return forceBalancedSplit(nodes, cytoscapeInstance, targetGroups);
  };

  // Helper function to force balanced splitting
  const forceBalancedSplit = (nodes, cytoscapeInstance, targetGroups) => {
    console.log('Force balanced split of', nodes.length, 'nodes into', targetGroups, 'groups');
    
    // Calculate node degrees for better splitting
    const nodeDegrees = new Map();
    nodes.forEach(node => {
      const edges = node.connectedEdges ? node.connectedEdges() : [];
      const relevantEdges = edges.filter(edge => {
        const otherNodeId = edge.source().id() === node.id() ? edge.target().id() : edge.source().id();
        return nodes.some(n => n.id() === otherNodeId);
      });
      nodeDegrees.set(node.id(), relevantEdges.length);
    });
    
    // Sort nodes by degree (high-degree nodes should be distributed across groups)
    const sortedNodes = [...nodes].sort((a, b) => 
      (nodeDegrees.get(b.id()) || 0) - (nodeDegrees.get(a.id()) || 0)
    );
    
    // Distribute nodes round-robin style to ensure balance
    const groups = Array.from({ length: targetGroups }, () => []);
    sortedNodes.forEach((node, index) => {
      const groupIndex = index % targetGroups;
      groups[groupIndex].push(node);
    });
    
    // Filter out empty groups
    const result = groups.filter(group => group.length > 0);
    console.log('Force split result:', result.map(g => g.length));
    return result;
  };

  // Helper function to calculate betweenness centrality for node sizing
  const calculateBetweennessCentrality = (nodes, cytoscapeInstance) => {
    console.log('Calculating betweenness centrality for', nodes.length, 'nodes');
    
    const nodeIds = new Set(nodes.map(n => n.id()));
    const centrality = new Map();
    
    // Initialize centrality scores
    nodes.forEach(node => {
      centrality.set(node.id(), 0);
    });
    
    // For each pair of nodes, find shortest paths and count how many pass through each node
    nodes.forEach((sourceNode, i) => {
      nodes.forEach((targetNode, j) => {
        if (i >= j) return; // Avoid duplicate calculations since graph is undirected
        
        const sourceId = sourceNode.id();
        const targetId = targetNode.id();
        
        if (sourceId === targetId) return;
        
        // Find all shortest paths between source and target using BFS
        const paths = findAllShortestPaths(sourceId, targetId, nodeIds, cytoscapeInstance);
        
        if (paths.length > 0) {
          // For each shortest path, increment centrality of intermediate nodes
          paths.forEach(path => {
            // Skip source and target nodes, only count intermediate nodes
            for (let k = 1; k < path.length - 1; k++) {
              const intermediateNodeId = path[k];
              if (centrality.has(intermediateNodeId)) {
                centrality.set(intermediateNodeId, centrality.get(intermediateNodeId) + 1 / paths.length);
              }
            }
          });
        }
      });
    });
    
    // Normalize centrality scores
    const maxCentrality = Math.max(...centrality.values());
    const minCentrality = Math.min(...centrality.values());
    const range = maxCentrality - minCentrality;
    
    if (range > 0) {
      centrality.forEach((value, nodeId) => {
        const normalized = (value - minCentrality) / range;
        centrality.set(nodeId, normalized);
      });
    } else {
      // If all centrality scores are the same, set them all to 0.5
      centrality.forEach((value, nodeId) => {
        centrality.set(nodeId, 0.5);
      });
    }
    
    console.log('Betweenness centrality calculation complete');
    return centrality;
  };

  // Helper function to find all shortest paths between two nodes
  const findAllShortestPaths = (sourceId, targetId, nodeIds, cytoscapeInstance) => {
    const visited = new Set();
    const distances = new Map();
    const predecessors = new Map();
    
    // Initialize distances and predecessors
    nodeIds.forEach(nodeId => {
      distances.set(nodeId, Infinity);
      predecessors.set(nodeId, []);
    });
    distances.set(sourceId, 0);
    
    const queue = [sourceId];
    
    // BFS to find shortest distances
    while (queue.length > 0) {
      const currentId = queue.shift();
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const currentDistance = distances.get(currentId);
      
      // Check all neighbors (treating edges as undirected)
      cytoscapeInstance.edges().forEach(edge => {
        const sourceNodeId = edge.source().id();
        const targetNodeId = edge.target().id();
        
        let neighborId = null;
        if (sourceNodeId === currentId && nodeIds.has(targetNodeId)) {
          neighborId = targetNodeId;
        } else if (targetNodeId === currentId && nodeIds.has(sourceNodeId)) {
          neighborId = sourceNodeId;
        }
        
        if (neighborId && !visited.has(neighborId)) {
          const newDistance = currentDistance + 1;
          
          if (newDistance < distances.get(neighborId)) {
            distances.set(neighborId, newDistance);
            predecessors.set(neighborId, [currentId]);
            queue.push(neighborId);
          } else if (newDistance === distances.get(neighborId)) {
            predecessors.get(neighborId).push(currentId);
          }
        }
      });
    }
    
    // Reconstruct all shortest paths
    const paths = [];
    const targetDistance = distances.get(targetId);
    
    if (targetDistance === Infinity) {
      return paths; // No path exists
    }
    
    // Recursive function to build all paths
    const buildPaths = (nodeId, currentPath) => {
      if (nodeId === sourceId) {
        paths.push([sourceId, ...currentPath.reverse()]);
        return;
      }
      
      const preds = predecessors.get(nodeId);
      preds.forEach(predId => {
        buildPaths(predId, [nodeId, ...currentPath]);
      });
    };
    
    buildPaths(targetId, []);
    return paths;
  };

  // Community detection using Louvain-like algorithm
  const detectCommunities = (nodes, cytoscapeInstance, resolution = 3.0) => {
    console.log('Starting community detection for', nodes.length, 'nodes with resolution:', resolution);
    
    if (nodes.length <= 1) {
      console.log('Too few nodes for community detection, returning individual nodes');
      return [nodes];
    }

    // For small node sets, force splitting to prevent single large clusters
    if (nodes.length <= 6) {
      console.log('Small node set detected, forcing balanced split');
      return forceSplitSmallGroup(nodes, cytoscapeInstance);
    }

    // Build adjacency map for the given nodes
    const nodeIds = new Set(nodes.map(n => n.id()));
    const adjacency = new Map();
    let totalEdges = 0;

    console.log('Node IDs for community detection:', Array.from(nodeIds));

    // Initialize adjacency map
    nodes.forEach(node => {
      adjacency.set(node.id(), new Map());
    });

    // Populate adjacency map with edge weights
    cytoscapeInstance.edges().forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      
      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        const weight = 1; // Can be enhanced with actual edge weights
        
        if (!adjacency.get(sourceId).has(targetId)) {
          adjacency.get(sourceId).set(targetId, 0);
        }
        if (!adjacency.get(targetId).has(sourceId)) {
          adjacency.get(targetId).set(sourceId, 0);
        }
        
        adjacency.get(sourceId).set(targetId, adjacency.get(sourceId).get(targetId) + weight);
        adjacency.get(targetId).set(sourceId, adjacency.get(targetId).get(sourceId) + weight);
        totalEdges += weight;
      }
    });

    console.log('Total edges found in community detection:', totalEdges);

    // If no edges found, create individual communities
    if (totalEdges === 0) {
      console.log('No edges found, creating individual communities');
      return nodes.map(node => [node]);
    }

    // Initialize each node in its own community
    const communities = new Map();
    const nodeDegrees = new Map();
    
    nodes.forEach((node, index) => {
      communities.set(node.id(), index);
      
      // Calculate node degree
      let degree = 0;
      if (adjacency.has(node.id())) {
        for (let weight of adjacency.get(node.id()).values()) {
          degree += weight;
        }
      }
      nodeDegrees.set(node.id(), degree);
    });

    // Modularity optimization iterations with stricter constraints
    let improved = true;
    let iteration = 0;
    const maxIterations = 5; // Reduced to prevent over-merging
    const maxCommunitySize = Math.max(2, Math.floor(nodes.length / 4)); // Smaller max community size

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (let node of nodes) {
        const nodeId = node.id();
        const currentCommunity = communities.get(nodeId);
        
        // Find neighboring communities
        const neighborCommunities = new Set();
        if (adjacency.has(nodeId)) {
          for (let neighborId of adjacency.get(nodeId).keys()) {
            if (communities.has(neighborId)) {
              neighborCommunities.add(communities.get(neighborId));
            }
          }
        }

        let bestCommunity = currentCommunity;
        let bestGain = 0;

        // Try moving to each neighboring community
        for (let targetCommunity of neighborCommunities) {
          if (targetCommunity === currentCommunity) continue;

          // Check community size constraint
          const targetCommunitySize = Array.from(communities.values()).filter(c => c === targetCommunity).length;
          if (targetCommunitySize >= maxCommunitySize) {
            continue; // Skip if target community is too large
          }

          const gain = calculateModularityGain(
            nodeId, currentCommunity, targetCommunity, 
            communities, adjacency, nodeDegrees, totalEdges, resolution
          );
          
          if (gain > bestGain) {
            bestGain = gain;
            bestCommunity = targetCommunity;
          }
        }

        // Move node if improvement found
        if (bestCommunity !== currentCommunity) {
          communities.set(nodeId, bestCommunity);
          improved = true;
        }
      }
    }

    // Group nodes by community
    const communityGroups = new Map();
    communities.forEach((communityId, nodeId) => {
      if (!communityGroups.has(communityId)) {
        communityGroups.set(communityId, []);
      }
      const node = nodes.find(n => n.id() === nodeId);
      if (node) {
        communityGroups.get(communityId).push(node);
      }
    });

    let result = Array.from(communityGroups.values()).filter(group => group.length > 0);
    console.log(`Community detection complete: ${result.length} communities found in ${iteration} iterations`);
    console.log('Community sizes:', result.map(c => c.length));
    
    // Validation: ensure no single large community dominates
    const largestCommunitySize = Math.max(...result.map(c => c.length));
    const averageCommunitySize = result.reduce((sum, c) => sum + c.length, 0) / result.length;
    
    console.log(`Community stats - Largest: ${largestCommunitySize}, Average: ${averageCommunitySize.toFixed(1)}, Total communities: ${result.length}`);
    
    // If we still have too few communities or one dominates, force better splitting
    if (result.length < 2 || largestCommunitySize > nodes.length * 0.6) {
      console.warn('Community detection resulted in poor separation, applying forced splitting');
      result = forceBalancedSplit(nodes, cytoscapeInstance, Math.max(2, Math.floor(nodes.length / 3)));
    }
    
    return result;
  };  // Calculate modularity gain for moving a node between communities
  const calculateModularityGain = (nodeId, fromCommunity, toCommunity, communities, adjacency, nodeDegrees, totalEdges, resolution) => {
    if (totalEdges === 0) return 0;

    const nodeDegree = nodeDegrees.get(nodeId) || 0;
    
    // Calculate edges to/from communities
    let edgesToFrom = 0;
    let edgesToTo = 0;
    
    if (adjacency.has(nodeId)) {
      for (let [neighborId, weight] of adjacency.get(nodeId)) {
        const neighborCommunity = communities.get(neighborId);
        if (neighborCommunity === fromCommunity) {
          edgesToFrom += weight;
        } else if (neighborCommunity === toCommunity) {
          edgesToTo += weight;
        }
      }
    }

    // Calculate community degrees
    let fromCommunityDegree = 0;
    let toCommunityDegree = 0;
    
    communities.forEach((community, nId) => {
      const degree = nodeDegrees.get(nId) || 0;
      if (community === fromCommunity && nId !== nodeId) {
        fromCommunityDegree += degree;
      } else if (community === toCommunity) {
        toCommunityDegree += degree;
      }
    });

    // Modularity gain calculation
    const deltaQ = (edgesToTo - edgesToFrom) / totalEdges - 
                  resolution * nodeDegree * (toCommunityDegree - fromCommunityDegree) / (2 * totalEdges * totalEdges);
    
    return deltaQ;
  };

  // Helper function to clear pathway highlighting
  const clearPathwayHighlighting = (cytoscapeInstance) => {
      
      // Calculate required radius to accommodate current node sizes with better spacing
      const nodeRadius = currentNodeSize / 2;
      const padding = 20; // Increased padding around nodes
      
      let requiredRadius;
      if (hypernode.nodes.length === 1) {
        requiredRadius = nodeRadius + padding;
      } else if (hypernode.nodes.length === 2) {
        // Linear arrangement - ensure nodes don't overlap
        requiredRadius = Math.max(nodeRadius + padding + 25, currentNodeSize * 0.8); 
      } else {
        // Circular arrangement - calculate radius needed for nodes not to overlap
        const nodeSpacing = Math.max(currentNodeSize + 8, 25); // Minimum spacing between nodes
        const circumference = hypernode.nodes.length * nodeSpacing;
        const circularRadius = circumference / (2 * Math.PI);
        requiredRadius = Math.max(circularRadius + nodeRadius + padding, nodeRadius + padding + 15);
      }
      
      // Use the larger of base radius or required radius for node accommodation
      const dynamicRadius = Math.max(baseRadius, requiredRadius);
      
      // Apply min/max bounds
      return Math.max(minRadius, Math.min(maxRadius, dynamicRadius));
    };

    // Update hypernode radii dynamically
    hypernodes.forEach(hypernode => {
      hypernode.radius = calculateDynamicHypernodeRadius(hypernode);
    });

    // Add hypernode background circles
    hypernodes.forEach(hypernode => {
      const hypernodeElement = {
        group: 'nodes',
        data: {
          id: hypernode.id,
          label: hypernode.label,
          type: 'hypernode-bg',
          isMainCluster: hypernode.isMainCluster,
          parentCluster: hypernode.parentCluster || '',
          subgraphIndex: hypernode.subgraphIndex || 0
        },
        position: hypernode.position,
        classes: hypernode.isMainCluster ? 'hypernode-bg main-cluster' : 'hypernode-bg mini-cluster'
      };

      cytoscapeInstance.add(hypernodeElement);
    });

    // Ensure all regular nodes (non-hypernode-bg) are visible and properly styled
    cytoscapeInstance.nodes().forEach(node => {
      if (!node.hasClass('hypernode-bg')) {
        node.style({
          'opacity': 1,
          'z-index': 5, // Higher than hypernode background (-1)
          'display': 'element'
        });
        
        // Store hypernode assignment in node data to prevent migration
        const nodeId = node.id();
        hypernodes.forEach(hypernode => {
          const nodeIds = hypernode.nodes.map(n => n.id());
          if (nodeIds.includes(nodeId)) {
            node.data('assignedHypernode', hypernode.id);
            node.data('assignedHypernodePosition', hypernode.position);
            node.data('assignedHypernodeRadius', hypernode.radius);
          }
        });
      }
    });

    // Style main cluster hypernodes
    cytoscapeInstance.style()
      .selector('.hypernode-bg.main-cluster')
      .style({
        'background-color': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          // Make colors much more transparent
          if (hypernode) {
            if (hypernode.borderColor === '#ff6b35') return 'rgba(255, 107, 53, 0.03)'; // Very transparent orange
            if (hypernode.borderColor === '#3498db') return 'rgba(52, 152, 219, 0.03)'; // Very transparent blue
            if (hypernode.borderColor === '#e74c3c') return 'rgba(231, 76, 60, 0.03)'; // Very transparent red
          }
          return 'rgba(200, 200, 200, 0.02)';
        },
        'border-color': '#000000', // Always black border
        'border-width': 2,
        'border-style': 'solid', // Solid black border
        'width': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          return hypernode ? hypernode.radius * 2 : 160;
        },
        'height': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          return hypernode ? hypernode.radius * 2 : 160;
        },
        'label': 'data(label)',
        'text-valign': 'top',
        'text-halign': 'center',
        'font-size': '12px',
        'font-weight': 'bold',
        'color': '#000000', // Black text
        'text-margin-y': -8,
        'opacity': 0.9,
        'z-index': -1
      })
      .update();

    // Style mini cluster hypernodes
    cytoscapeInstance.style()
      .selector('.hypernode-bg.mini-cluster')
      .style({
        'background-color': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          // Make colors much more transparent
          if (hypernode) {
            if (hypernode.borderColor === '#ff6b35') return 'rgba(255, 107, 53, 0.025)'; // Very transparent orange
            if (hypernode.borderColor === '#3498db') return 'rgba(52, 152, 219, 0.025)'; // Very transparent blue
            if (hypernode.borderColor === '#e74c3c') return 'rgba(231, 76, 60, 0.025)'; // Very transparent red
          }
          return 'rgba(52, 152, 219, 0.025)';
        },
        'border-color': '#000000', // Always black border
        'border-width': 1.5,
        'border-style': 'solid', // Solid black border
        'width': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          return hypernode ? hypernode.radius * 2 : 100;
        },
        'height': (ele) => {
          const hypernodeId = ele.data('id');
          const hypernode = hypernodes.find(h => h.id === hypernodeId);
          return hypernode ? hypernode.radius * 2 : 100;
        },
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': '9px',
        'font-weight': 'normal',
        'color': '#000000', // Black text
        'text-margin-y': 3,
        'opacity': 0.8,
        'z-index': -1
      })
      .update();

    // Add hyperedge visualization
    hyperedges.forEach(hyperedge => {
      const sourceHypernode = hypernodes.find(h => h.id === hyperedge.source);
      const targetHypernode = hypernodes.find(h => h.id === hyperedge.target);

      if (sourceHypernode && targetHypernode) {
        const hyperedgeElement = {
          group: 'edges',
          data: {
            id: `hyperedge_${hyperedge.id}`,
            source: hyperedge.source,
            target: hyperedge.target,
            weight: hyperedge.weight,
            connections: hyperedge.connections.length,
            type: 'hyperedge'
          },
          classes: 'hyperedge'
        };

        cytoscapeInstance.add(hyperedgeElement);
      }
    });

    // Add inter-cluster edges for all mini clusters (MIE, KE, AO)
    const miniClusters = hypernodes.filter(h => !h.isMainCluster);
    if (miniClusters.length > 1) {
      // Find connections between all mini clusters
      const edges = cytoscapeInstance.edges().filter(edge => !edge.hasClass('hyperedge'));
      const miniClusterConnections = new Map();
      
      edges.forEach(edge => {
        const sourceNode = edge.source();
        const targetNode = edge.target();
        
        let sourceMiniCluster = null;
        let targetMiniCluster = null;
        let sourceClusterType = null;
        let targetClusterType = null;
        
        miniClusters.forEach(cluster => {
          const nodeIds = cluster.nodes.map(n => n.id());
          if (nodeIds.includes(sourceNode.id())) {
            sourceMiniCluster = cluster.id;
            sourceClusterType = cluster.parentCluster;
          }
          if (nodeIds.includes(targetNode.id())) {
            targetMiniCluster = cluster.id;
            targetClusterType = cluster.parentCluster;
          }
        });
        
        if (sourceMiniCluster && targetMiniCluster && sourceMiniCluster !== targetMiniCluster) {
          const connectionId = `${sourceMiniCluster}_${targetMiniCluster}`;
          if (!miniClusterConnections.has(connectionId)) {
            miniClusterConnections.set(connectionId, {
              source: sourceMiniCluster,
              target: targetMiniCluster,
              sourceType: sourceClusterType,
              targetType: targetClusterType,
              weight: 0
            });
          }
          miniClusterConnections.get(connectionId).weight += 1;
        }
      });
      
      // Add mini-cluster connections with different styles based on connection type
      miniClusterConnections.forEach((connection, connectionId) => {
        const isIntraClusterType = connection.sourceType === connection.targetType;
        const miniHyperedgeElement = {
          group: 'edges',
          data: {
            id: `mini_hyperedge_${connectionId}`,
            source: connection.source,
            target: connection.target,
            weight: connection.weight,
            sourceType: connection.sourceType,
            targetType: connection.targetType,
            isIntraClusterType: isIntraClusterType,
            type: 'mini-hyperedge'
          },
          classes: isIntraClusterType ? 'mini-hyperedge intra-type' : 'mini-hyperedge inter-type'
        };
        
        cytoscapeInstance.add(miniHyperedgeElement);
      });
    }

    // Style main hyperedges
    cytoscapeInstance.style()
      .selector('.hyperedge')
      .style({
        'width': (ele) => Math.max(5, Math.min(20, ele.data('weight') * 2)),
        'line-color': '#9b59b6',
        'target-arrow-color': '#9b59b6',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 80,
        'opacity': 0.7,
        'line-style': 'solid',
        'label': (ele) => `${ele.data('connections')} connections`,
        'font-size': '10px',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'z-index': 1
      })
      .update();

    // Style mini hyperedges - intra-type connections (within same cluster type)
    cytoscapeInstance.style()
      .selector('.mini-hyperedge.intra-type')
      .style({
        'width': (ele) => Math.max(2, Math.min(6, ele.data('weight') * 1.5)),
        'line-color': (ele) => {
          const sourceType = ele.data('sourceType');
          switch(sourceType) {
            case 'MIE': return '#e67e22'; // Orange for MIE intra-connections
            case 'KE': return '#27ae60';  // Green for KE intra-connections  
            case 'AO': return '#e74c3c';  // Red for AO intra-connections
            default: return '#95a5a6';
          }
        },
        'target-arrow-color': (ele) => {
          const sourceType = ele.data('sourceType');
          switch(sourceType) {
            case 'MIE': return '#e67e22';
            case 'KE': return '#27ae60';
            case 'AO': return '#e74c3c';
            default: return '#95a5a6';
          }
        },
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 30,
        'opacity': 0.6,
        'line-style': 'dotted',
        'label': (ele) => `${ele.data('weight')}`,
        'font-size': '8px',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'z-index': 1
      })
      .update();

    // Style mini hyperedges - inter-type connections (between different cluster types)
    cytoscapeInstance.style()
      .selector('.mini-hyperedge.inter-type')
      .style({
        'width': (ele) => Math.max(3, Math.min(10, ele.data('weight') * 2)),
        'line-color': '#8e44ad', // Purple for cross-type connections
        'target-arrow-color': '#8e44ad',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 50,
        'opacity': 0.8,
        'line-style': 'dashed',
        'label': (ele) => `${ele.data('sourceType')}→${ele.data('targetType')} (${ele.data('weight')})`,
        'font-size': '9px',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'z-index': 2
      })
      .update();

    cytoscapeInstance.fit(cytoscapeInstance.elements(), 50);
    
    // Add hypernode drag functionality to move inner nodes with the hypernode
    cytoscapeInstance.on('drag', '.hypernode-bg', (evt) => {
      const hypernode = evt.target;
      const hypernodeId = hypernode.data('id');
      const hypernodeData = hypernodes.find(h => h.id === hypernodeId);
      
      if (hypernodeData) {
        const newPosition = hypernode.position();
        const hypernodeRadius = hypernodeData.radius || 70;
        
        // Move all inner nodes relative to hypernode center with consistent positioning
        hypernodeData.nodes.forEach((node, nodeIndex) => {
          let relativeX, relativeY;
          
          if (hypernodeData.nodes.length === 1) {
            // Single node stays at hypernode center
            relativeX = 0;
            relativeY = 0;
          } else if (hypernodeData.nodes.length === 2) {
            // Two nodes arranged horizontally
            const offset = hypernodeRadius * 0.5;
            relativeX = nodeIndex === 0 ? -offset : offset;
            relativeY = 0;
          } else if (hypernodeData.nodes.length === 3) {
            // Triangle arrangement starting from top
            const angles = [-Math.PI/2, Math.PI/6, 5*Math.PI/6];
            const radius = hypernodeRadius * 0.55;
            relativeX = Math.cos(angles[nodeIndex]) * radius;
            relativeY = Math.sin(angles[nodeIndex]) * radius;
          } else if (hypernodeData.nodes.length === 4) {
            // Square arrangement starting from top
            const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI];
            const radius = hypernodeRadius * 0.6;
            relativeX = Math.cos(angles[nodeIndex]) * radius;
            relativeY = Math.sin(angles[nodeIndex]) * radius;
          } else {
            // Circular arrangement starting from top
            const angle = (2 * Math.PI * nodeIndex) / hypernodeData.nodes.length - Math.PI/2;
            const radius = hypernodeRadius * 0.65;
            relativeX = Math.cos(angle) * radius;
            relativeY = Math.sin(angle) * radius;
          }
          
          // Apply the relative position to the new hypernode center
          node.position({
            x: newPosition.x + relativeX,
            y: newPosition.y + relativeY
          });
        });
        
        // Update hypernode position data
        hypernodeData.position = { x: newPosition.x, y: newPosition.y };
      }
    });

    // Make hypernode backgrounds draggable, and allow controlled node dragging in hypergraph mode
    cytoscapeInstance.$('.hypernode-bg').grabify();
    
    // In hypergraph mode, allow individual nodes to be dragged but constrain them to hypernode boundaries
    // The constraint logic is handled in the drag event handler below
    cytoscapeInstance.$('node:not(.hypernode-bg)').grabify();

    // Add hypernode click functionality
    cytoscapeInstance.on('tap', '.hypernode-bg', (evt) => {
      const hypernode = evt.target;
      const hypernodeId = hypernode.data('id');
      const hypernodeData = hypernodes.find(h => h.id === hypernodeId);
      
      if (hypernodeData) {
        // Find connected nodes within this hypernode
        const connectedNodes = findConnectedNodes(hypernodeData.nodes, cytoscapeInstance);
        
        // Find connected hypernodes
        const connectedHypernodes = findConnectedHypernodes(hypernodeData, hypernodes, currentHyperedges);
        
        // Enhance the hypernode data with connection information
        const enhancedHypernodeData = {
          ...hypernodeData,
          connectedNodes: connectedNodes,
          connectedHypernodes: connectedHypernodes,
          totalConnectedHypernodes: connectedHypernodes.length,
          incomingConnections: connectedHypernodes.filter(ch => ch.connectionType === 'incoming').length,
          outgoingConnections: connectedHypernodes.filter(ch => ch.connectionType === 'outgoing').length
        };
        
        console.log('Enhanced hypernode data:', {
          hypernodeId: hypernodeData.id,
          label: hypernodeData.label,
          nodesInside: hypernodeData.nodes.length,
          connectedNodes: {
            mie: connectedNodes.mie.length,
            ke: connectedNodes.ke.length,
            ao: connectedNodes.ao.length,
            other: connectedNodes.other.length
          },
          connectedHypernodes: {
            total: connectedHypernodes.length,
            incoming: connectedHypernodes.filter(ch => ch.connectionType === 'incoming').length,
            outgoing: connectedHypernodes.filter(ch => ch.connectionType === 'outgoing').length
          }
        });
        
        setSelectedHypernode(enhancedHypernodeData);
        setShowHypernodeTable(true);
      }
      
      evt.stopPropagation();
    });
  };



  // Helper function to clear pathway highlighting
  const clearPathwayHighlighting = (cytoscapeInstance) => {
    // Highlighting removed - this function is now a no-op but kept for compatibility
    return;
  };

  // Helper function to find all connected hypernodes for a hypernode
  const findConnectedHypernodes = (targetHypernode, allHypernodes, hyperedges) => {
    try {
      console.log('Finding connected hypernodes for:', targetHypernode.label);
      
      if (!targetHypernode || !allHypernodes || !hyperedges) {
        console.warn('Invalid parameters for findConnectedHypernodes');
        return [];
      }
      
      const connectedHypernodes = [];
      const targetHypernodeId = targetHypernode.id;
      
      // Find all hyperedges that connect to this hypernode
      hyperedges.forEach(hyperedge => {
        let connectedHypernodeId = null;
        let connectionType = null;
        
        if (hyperedge.source === targetHypernodeId) {
          connectedHypernodeId = hyperedge.target;
          connectionType = 'outgoing';
        } else if (hyperedge.target === targetHypernodeId) {
          connectedHypernodeId = hyperedge.source;
          connectionType = 'incoming';
        }
        
        if (connectedHypernodeId) {
          const connectedHypernode = allHypernodes.find(h => h.id === connectedHypernodeId);
          if (connectedHypernode) {
            connectedHypernodes.push({
              hypernode: connectedHypernode,
              connectionType: connectionType,
              weight: hyperedge.weight,
              connections: hyperedge.connections || [],
              connectionDetails: hyperedge.connections?.map(conn => ({
                sourceNode: conn.sourceNode,
                targetNode: conn.targetNode,
                relationship: conn.relationship
              })) || []
            });
          }
        }
      });
      
      // Also check mini-hyperedges for more detailed connections
      const cytoscapeInstance = cy;
      if (cytoscapeInstance) {
        const miniHyperedges = cytoscapeInstance.$('.mini-hyperedge');
        miniHyperedges.forEach(edge => {
          const edgeData = edge.data();
          let connectedHypernodeId = null;
          let connectionType = null;
          
          if (edgeData.source === targetHypernodeId) {
            connectedHypernodeId = edgeData.target;
            connectionType = 'outgoing';
          } else if (edgeData.target === targetHypernodeId) {
            connectedHypernodeId = edgeData.source;
            connectionType = 'incoming';
          }
          
          if (connectedHypernodeId && !connectedHypernodes.find(ch => ch.hypernode.id === connectedHypernodeId)) {
            const connectedHypernode = allHypernodes.find(h => h.id === connectedHypernodeId);
            if (connectedHypernode) {
              connectedHypernodes.push({
                hypernode: connectedHypernode,
                connectionType: connectionType,
                weight: edgeData.weight || 1,
                connections: [],
                connectionDetails: [],
                isInterCluster: edgeData.isIntraClusterType === false,
                sourceType: edgeData.sourceType,
                targetType: edgeData.targetType
              });
            }
          }
        });
      }
      
      console.log('Found connected hypernodes:', connectedHypernodes.length);
      return connectedHypernodes;
    } catch (error) {
      console.error('Error in findConnectedHypernodes:', error);
      return [];
    }
  };

  // Helper function to find all connected nodes for a hypernode
  const findConnectedNodes = (hypernodeNodes, cytoscapeInstance) => {
    try {
      console.log('findConnectedNodes called with:', hypernodeNodes?.length, 'nodes');
      
      if (!cytoscapeInstance || !hypernodeNodes || hypernodeNodes.length === 0) {
        console.warn('Invalid parameters for findConnectedNodes');
        return { mie: [], ke: [], ao: [], other: [] };
      }
      
      const connectedNodes = { mie: [], ke: [], ao: [], other: [] };
      const visited = new Set();
      const hypernodeNodeIds = new Set();
      
      // Safely extract hypernode node IDs
      hypernodeNodes.forEach(node => {
        try {
          const nodeId = typeof node.id === 'function' ? node.id() : node.id;
          if (nodeId) {
            hypernodeNodeIds.add(nodeId);
          }
        } catch (error) {
          console.warn('Error extracting node ID:', error);
        }
      });
      
      console.log('Hypernode contains nodes:', Array.from(hypernodeNodeIds));
      
      // Find all nodes connected to any node in the hypernode
      hypernodeNodes.forEach(node => {
        try {
          const connectedEdges = node.connectedEdges ? node.connectedEdges() : [];
          console.log('Node has', connectedEdges.length, 'connected edges');
          
          connectedEdges.forEach(edge => {
            try {
              const otherNode = edge.otherNode(node);
              if (!otherNode) return;
              
              const otherNodeId = typeof otherNode.id === 'function' ? otherNode.id() : otherNode.id;
              if (!otherNodeId) return;
              
              // Skip if already visited or if it's part of the original hypernode
              if (visited.has(otherNodeId) || hypernodeNodeIds.has(otherNodeId)) return;
              
              visited.add(otherNodeId);
              const nodeType = otherNode.data ? otherNode.data('type') : '';
              const nodeData = {
                id: otherNodeId,
                label: (otherNode.data ? otherNode.data('label') : '') || otherNodeId,
                type: nodeType,
                aop: (otherNode.data ? otherNode.data('aop') : '') || '-',
                ontology: (otherNode.data ? otherNode.data('ontology') : '') || '-',
                relationship: (edge.data ? edge.data('relationship') : '') || '-'
              };
              
              switch (nodeType) {
                case 'MolecularInitiatingEvent':
                  connectedNodes.mie.push(nodeData);
                  break;
                case 'KeyEvent':
                  connectedNodes.ke.push(nodeData);
                  break;
                case 'AdverseOutcome':
                  connectedNodes.ao.push(nodeData);
                  break;
                default:
                  connectedNodes.other.push(nodeData);
                  break;
              }
            } catch (edgeError) {
              console.warn('Error processing edge:', edgeError);
            }
          });
        } catch (nodeError) {
          console.warn('Error processing node connections:', nodeError);
        }
      });
      
      console.log('Found connected nodes:', {
        mie: connectedNodes.mie.length,
        ke: connectedNodes.ke.length,
        ao: connectedNodes.ao.length,
        other: connectedNodes.other.length
      });
      
      return connectedNodes;
    } catch (error) {
      console.error('Error in findConnectedNodes:', error);
      return { mie: [], ke: [], ao: [], other: [] };
    }
  };

  const exportAsCSV = () => {
    if (!data || !data.nodes) return;
    
    // Export nodes
    const nodeHeaders = ['id', 'label', 'type', 'aop', 'ontology', 'ontology_term', 'change'];
    const nodeRows = data.nodes.map(node => [
      node.id || '',
      node.label || '',
      node.type || '',
      node.aop || '',
      node.ontology || '',
      node.ontology_term || '',
      node.change || ''
    ]);
    
    const nodeCSV = [nodeHeaders, ...nodeRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Export edges
    const edgeHeaders = ['source', 'target', 'relationship', 'confidence', 'adjacency', 'aop'];
    const edgeRows = data.edges.map(edge => [
      edge.source || '',
      edge.target || '',
      edge.relationship || '',
      edge.confidence || '',
      edge.adjacency || '',
      edge.aop || ''
    ]);
    
    const edgeCSV = [edgeHeaders, ...edgeRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Download nodes CSV
    const nodeBlob = new Blob([nodeCSV], { type: 'text/csv' });
    const nodeLink = document.createElement('a');
    nodeLink.download = `aop-nodes-${Date.now()}.csv`;
    nodeLink.href = URL.createObjectURL(nodeBlob);
    nodeLink.click();
    
    // Download edges CSV
    const edgeBlob = new Blob([edgeCSV], { type: 'text/csv' });
    const edgeLink = document.createElement('a');
    edgeLink.download = `aop-edges-${Date.now()}.csv`;
    edgeLink.href = URL.createObjectURL(edgeBlob);
    edgeLink.click();
  };

// Node colors definition
const nodeColors = {
  'MolecularInitiatingEvent': '#10b981', // green
  'KeyEvent': '#3b82f6', // blue
  'AdverseOutcome': '#ec4899', // pink
  'default': '#6b7280' // gray
};

// Performance-optimized node styling for large graphs
const getOptimizedNodeStyle = (isLargeGraph, centralityScores = null, baseNodeSize = 20) => {
  if (isLargeGraph) {
    return {
      'background-color': (ele) => {
        const nodeType = ele.data('type');
        return nodeColors[nodeType] || nodeColors.default;
      },
      'shape': (ele) => {
        const nodeType = ele.data('type');
        if (nodeType === 'MolecularInitiatingEvent') return 'triangle';
        if (nodeType === 'KeyEvent') return 'rectangle';
        if (nodeType === 'AdverseOutcome') return 'ellipse';
        return 'ellipse'; // default
      },
      'width': 14, // Slightly bigger for visibility
      'height': 14,
      'label': '', // Hide labels for performance in large graphs
      'font-size': '0px', // Hide font for large graphs
      'overlay-opacity': 0, // Disable overlays
      'transition-property': 'none' // Disable transitions
    };
  } else {
    return {
      'background-color': (ele) => {
        const nodeType = ele.data('type');
        return nodeColors[nodeType] || nodeColors.default;
      },
      'shape': (ele) => {
        const nodeType = ele.data('type');
        if (nodeType === 'MolecularInitiatingEvent') return 'triangle';
        if (nodeType === 'KeyEvent') return 'rectangle';
        if (nodeType === 'AdverseOutcome') return 'ellipse';
        return 'ellipse'; // default
      },
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '8px', // Slightly bigger font
      'font-family': 'Arial, sans-serif',
      'font-weight': 'bold', // Make text bolder for better readability
      'width': (ele) => {
        const nodeId = ele.data('id');
        const nodeType = ele.data('type');
        
        // Base size calculation based on node type and global size setting
        let baseSize;
        if (nodeType === 'MolecularInitiatingEvent' || nodeType === 'AdverseOutcome') {
          baseSize = Math.max(baseNodeSize * 1.2, 24); // Bigger main nodes
        } else {
          baseSize = baseNodeSize; // Use global node size setting
        }
        
        // Apply betweenness centrality scaling if available
        if (centralityScores && centralityScores.has(nodeId)) {
          const centrality = centralityScores.get(nodeId);
          // Scale node size by centrality (0.8x to 1.4x the base size)
          const scaleFactor = 0.8 + (centrality * 0.6);
          return Math.round(baseSize * scaleFactor);
        }
        
        return baseSize;
      },
      'height': (ele) => {
        const nodeId = ele.data('id');
        const nodeType = ele.data('type');
        
        // Base size calculation based on node type and global size setting
        let baseSize;
        if (nodeType === 'MolecularInitiatingEvent' || nodeType === 'AdverseOutcome') {
          baseSize = Math.max(baseNodeSize * 1.2, 24); // Bigger main nodes
        } else {
          baseSize = baseNodeSize; // Use global node size setting
        }
        
        // Apply betweenness centrality scaling if available
        if (centralityScores && centralityScores.has(nodeId)) {
          const centrality = centralityScores.get(nodeId);
          // Scale node size by centrality (0.8x to 1.4x the base size)
          const scaleFactor = 0.8 + (centrality * 0.6);
          return Math.round(baseSize * scaleFactor);
        }
        
        return baseSize;
      },
      'text-wrap': 'wrap',
      'text-max-width': '35px'
    };
  }
};  // Performance-optimized edge styling for large graphs
  const getOptimizedEdgeStyle = (isLargeGraph) => {
    if (isLargeGraph) {
      return {
        'width': 1, // Thinner edges for performance
        'line-color': '#d1d5db', // Light gray for performance
        'target-arrow-shape': 'none', // No arrows for performance
        'curve-style': 'straight', // Straight lines for performance
        'label': '', // No labels for performance
        'overlay-opacity': 0, // Disable overlays
        'transition-property': 'none' // Disable transitions
      };
    } else {
      return {
        'width': 1.5, // Thinner edges
        'line-color': '#d1d5db', // Light gray for better contrast
        'target-arrow-color': '#9ca3af', // Slightly darker gray for arrows
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1,
        'label': (ele) => {
          const rel = ele.data('relationship');
          return rel ? rel.substring(0, 15) : '';
        },
        'font-size': '8px',
        'color': '#6b7280', // Gray text for edge labels
        'text-background-color': 'rgba(255, 255, 255, 0.8)',
        'text-background-opacity': 0.7,
        'text-background-padding': '1px',
        'opacity': 0.7 // Make edges more subtle
      };
    }
  };

  // Optimized layout function for large graphs
  const getOptimizedLayoutOptions = (layoutName, isLargeGraph, nodeCount) => {
    if (isLargeGraph) {
      // For large graphs, use simpler, faster layouts
      switch (layoutName) {
        case 'layered-vertical':
        case 'layered-horizontal':
          return { name: 'grid', animate: false, fit: true, padding: 30 };
        case 'breadthfirst':
          return { 
            name: 'breadthfirst', 
            animate: false, 
            fit: true, 
            padding: 30,
            directed: true,
            spacingFactor: 0.8 // Tighter spacing
          };
        case 'cose-bilkent':
          return {
            name: 'cose-bilkent',
            animate: false,
            fit: true,
            padding: 30,
            nodeRepulsion: 1000, // Reduced for performance
            idealEdgeLength: 30,
            edgeElasticity: 0.1,
            numIter: nodeCount > 1500 ? 100 : 500, // Fewer iterations for very large graphs
            tile: true,
            randomize: false
          };
        default:
          return { 
            name: 'grid', 
            animate: false, 
            fit: true, 
            padding: 30,
            spacingFactor: 0.8
          };
      }
    } else {
      // Standard layout options for smaller graphs
      return {
        name: layoutName === 'layered-vertical' || layoutName === 'layered-horizontal' ? 'random' : layoutName,
        animate: layoutName === 'layered-vertical' || layoutName === 'layered-horizontal' ? false : true,
        animationDuration: 1000,
        fit: true,
        padding: 50,
        nodeRepulsion: 4500,
        idealEdgeLength: 50,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        directed: true,
        roots: data.nodes?.filter(n => n.type === 'MolecularInitiatingEvent').map(n => n.id) || [],
        spacingFactor: 1.5
      };
    }
  };

  // Debounced layout application for performance
  const debouncedApplyLayout = useCallback((cytoscapeInstance, layoutOptions) => {
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }
    
    layoutTimeoutRef.current = setTimeout(() => {
      if (cytoscapeInstance && !cytoscapeInstance.destroyed()) {
        const layout = cytoscapeInstance.layout(layoutOptions);
        layout.run();
      }
    }, 300);
  }, []);

  // Optimized batch update function
  const batchUpdateElements = useCallback((cytoscapeInstance, elements) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (cytoscapeInstance && !cytoscapeInstance.destroyed()) {
        cytoscapeInstance.batch(() => {
          elements.forEach(element => {
            cytoscapeInstance.add(element);
          });
        });
      }
    });
  }, []);

  useEffect(() => {
    console.log('NetworkGraph useEffect triggered with data:', data);
    if (!containerRef.current || !data) {
      console.log('Container or data not available:', { container: !!containerRef.current, data: !!data });
      return;
    }

    const currentNodeCount = data.nodes?.length || 0;
    const currentIsLargeGraph = currentNodeCount > 500;
    
    setNodeCount(currentNodeCount);
    setIsLargeGraph(currentIsLargeGraph);

    console.log('Initializing Cytoscape with nodes:', currentNodeCount, 'edges:', data.edges?.length, 'isLargeGraph:', currentIsLargeGraph);

    // Performance optimization: batch process elements for large graphs
    const createElements = () => {
      const nodeElements = data.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label || node.id,
          type: node.type || 'default',
          aop: node.aop || '',
          ontology: node.ontology || '',
          ontology_term: node.ontology_term || '',
          change: node.change || ''
        }
      }));

      const edgeElements = data.edges.map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          relationship: edge.relationship || '',
          confidence: edge.confidence || '',
          evidence: edge.evidence || '',
          adjacency: edge.adjacency || ''
        }
      }));

      return [...nodeElements, ...edgeElements];
    };

    // Initialize Cytoscape with performance optimizations
    const cytoscapeInstance = cytoscape({
      container: containerRef.current,
      elements: createElements(),
      style: [
        {
          selector: 'node',
          style: getOptimizedNodeStyle(currentIsLargeGraph, null, 20) // Initial style without centrality
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': currentIsLargeGraph ? 2 : 4,
            'border-color': '#ff6b35',
            'background-color': '#ff6b35'
          }
        },
        {
          selector: 'edge',
          style: getOptimizedEdgeStyle(currentIsLargeGraph)
        },
        {
          selector: 'edge:selected',
          style: {
            'width': currentIsLargeGraph ? 2 : 4,
            'line-color': '#ff6b35',
            'target-arrow-color': '#ff6b35'
          }
        }
      ],
      layout: getOptimizedLayoutOptions(layoutName, currentIsLargeGraph, currentNodeCount),
      minZoom: 0.1,
      maxZoom: currentIsLargeGraph ? 2 : 3, // Limit zoom for large graphs
      wheelSensitivity: currentIsLargeGraph ? 0.1 : 0.2, // Less sensitive for large graphs
      // Performance optimizations for large graphs
      textureOnViewport: currentIsLargeGraph,
      motionBlur: !currentIsLargeGraph,
      pixelRatio: currentIsLargeGraph ? 1 : 'auto'
    });

    // Calculate betweenness centrality and update node styles
    if (!currentIsLargeGraph) { // Only for smaller graphs to avoid performance issues
      console.log('Calculating betweenness centrality for node sizing');
      const nodes = cytoscapeInstance.nodes();
      const centralityScores = calculateBetweennessCentrality(nodes.toArray(), cytoscapeInstance);
      setBetweennessCentrality(centralityScores);
      
      // Update node styles with centrality-based sizing
      cytoscapeInstance.style()
        .selector('node')
        .style(getOptimizedNodeStyle(currentIsLargeGraph, centralityScores, 20))
        .update();
    }

    // Event handlers with performance optimizations
    cytoscapeInstance.on('tap', 'node', (evt) => {
      const node = evt.target;
      
      // Skip if this is a hypernode background
      if (node.hasClass('hypernode-bg')) {
        return;
      }
      
      const nodeData = {
        id: node.data('id'),
        label: node.data('label'),
        type: node.data('type'),
        aop: node.data('aop'),
        ontology: node.data('ontology'),
        ontology_term: node.data('ontology_term'),
        change: node.data('change')
      };
      
      // Add to node chain if searchPanelRef is available
      if (searchPanelRef && searchPanelRef.current) {
        searchPanelRef.current.addToNodeChain(nodeData.id);
      }
      
      onNodeSelect && onNodeSelect(nodeData);
    });

    // Add drag functionality for inner nodes within hypernodes - CONSTRAIN TO HYPERNODE
    cytoscapeInstance.on('drag', 'node', (evt) => {
      const node = evt.target;
      
      // Skip if this is a hypernode background
      if (node.hasClass('hypernode-bg')) {
        return;
      }
      
      // If we're in hypergraph mode, constrain inner nodes to stay within their hypernode
      if (hypergraphMode !== 'none' && hypernodes.length > 0) {
        const nodeId = node.id();
        const nodePosition = node.position();
        
        // First try to get assigned hypernode from node data
        const assignedHypernodeId = node.data('assignedHypernode');
        let parentHypernode = null;
        
        if (assignedHypernodeId) {
          parentHypernode = hypernodes.find(h => h.id === assignedHypernodeId);
        }
        
        // Fallback: Find which hypernode this node belongs to by searching
        if (!parentHypernode) {
          hypernodes.forEach(hypernode => {
            const nodeIds = hypernode.nodes.map(n => n.id());
            if (nodeIds.includes(nodeId)) {
              parentHypernode = hypernode;
              // Update the assignment
              node.data('assignedHypernode', hypernode.id);
              return; // Exit forEach early
            }
          });
        }
        
        if (parentHypernode) {
          const hypernodeCenter = parentHypernode.position;
          const hypernodeRadius = parentHypernode.radius || 80;
          const maxDistance = hypernodeRadius * 0.45; // Very strict constraint - 45% of radius
          
          // Calculate distance from hypernode center
          const dx = nodePosition.x - hypernodeCenter.x;
          const dy = nodePosition.y - hypernodeCenter.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If node is being dragged outside hypernode bounds, constrain it
          if (distance > maxDistance) {
            const angle = Math.atan2(dy, dx);
            const constrainedX = hypernodeCenter.x + Math.cos(angle) * maxDistance;
            const constrainedY = hypernodeCenter.y + Math.sin(angle) * maxDistance;
            
            // Immediately set the constrained position
            node.position({
              x: constrainedX,
              y: constrainedY
            });
            
            // Prevent further dragging beyond this point
            evt.preventDefault();
            evt.stopPropagation();
          }
        } else {
          // If node doesn't belong to any hypernode, prevent dragging in hypergraph mode
          console.warn('Node', nodeId, 'not assigned to any hypernode, preventing drag');
          evt.preventDefault();
          evt.stopPropagation();
        }
      }
    });

    cytoscapeInstance.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = {
        id: edge.data('id'),
        source: edge.data('source'),
        target: edge.data('target'),
        relationship: edge.data('relationship'),
        confidence: edge.data('confidence'),
        evidence: edge.data('evidence'),
        adjacency: edge.data('adjacency')
      };
      
      // Auto-select connected nodes when relationship is clicked
      if (searchPanelRef && searchPanelRef.current) {
        searchPanelRef.current.addToNodeChain(edgeData.source);
        searchPanelRef.current.addToNodeChain(edgeData.target);
      }
      
      onEdgeSelect && onEdgeSelect(edgeData);
    });

    cytoscapeInstance.on('tap', (evt) => {
      if (evt.target === cytoscapeInstance) {
        // Clicked on background - clear selections
        onNodeSelect && onNodeSelect(null);
        onEdgeSelect && onEdgeSelect(null);
      }
    });

    // Performance optimized layout handling
    cytoscapeInstance.on('layoutstop', () => {
      console.log('Layout complete for', currentNodeCount, 'nodes');
      
      // Use debounced layout application for better performance
      debouncedApplyLayout(() => {
        // Apply custom layered layout after initial layout if needed
        if (layoutName === 'layered-vertical' || layoutName === 'layered-horizontal') {
          applyLayeredLayout(cytoscapeInstance, layoutName === 'layered-vertical' ? 'vertical' : 'horizontal');
        }

        // Apply hypergraph layout if enabled (only after normal layout is complete)
        if (hypergraphMode !== 'none') {
          setTimeout(() => {
            if (cytoscapeInstance && !cytoscapeInstance.destroyed()) {
              applyHypergraphLayout(cytoscapeInstance);
            }
          }, 1500);
        }
      });
    });

    // Performance monitoring for large graphs
    if (currentIsLargeGraph) {
      console.log(`Large graph detected (${currentNodeCount} nodes). Performance optimizations enabled.`);
    }

    setCy(cytoscapeInstance);
    cyRef.current = cytoscapeInstance;

    // Apply custom layered layout if selected with performance consideration
    if (layoutName === 'layered-vertical' || layoutName === 'layered-horizontal') {
      const timeout = currentIsLargeGraph ? 1000 : 500; // Longer timeout for large graphs
      setTimeout(() => {
        console.log('Applying custom layered layout after initialization');
        applyLayeredLayout(cytoscapeInstance, layoutName === 'layered-vertical' ? 'vertical' : 'horizontal');
      }, timeout);
    }

    return () => {
      console.log('Cleaning up Cytoscape instance');
      
      // Clear performance optimization timers
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (cytoscapeInstance) {
        // Clear pathway highlighting before destroying
        clearPathwayHighlighting(cytoscapeInstance);
        cytoscapeInstance.destroy();
      }
    };
  }, [data, theme, layoutName]);

  // Update selection highlighting
  useEffect(() => {
    if (!cy) return;

    // Clear previous selections
    cy.elements().removeClass('selected');

    if (selectedNode) {
      const node = cy.getElementById(selectedNode.id);
      if (node.length > 0) {
        node.addClass('selected');
        cy.center(node);
      }
    }

    if (selectedEdge) {
      const edge = cy.getElementById(selectedEdge.id);
      if (edge.length > 0) {
        edge.addClass('selected');
      }
    }
  }, [selectedNode, selectedEdge, cy]);

  const handleZoomIn = () => {
    if (cy) {
      cy.zoom(cy.zoom() * 1.2);
      cy.center();
    }
  };

  const handleZoomOut = () => {
    if (cy) {
      cy.zoom(cy.zoom() * 0.8);
      cy.center();
    }
  };

  const handleReset = () => {
    if (cy) {
      cy.fit();
      cy.zoom(1);
    }
  };

  const handleExport = () => {
    exportAsPNG();
  };

  const handleCSVExport = () => {
    exportAsCSV();
  };

  const handleLayoutChange = (newLayout) => {
    console.log('Changing layout to:', newLayout);
    setLayoutName(newLayout);
    if (cy) {
      if (newLayout === 'layered-vertical' || newLayout === 'layered-horizontal') {
        // Apply custom layered layout with performance consideration
        console.log('Applying custom layered layout');
        debouncedApplyLayout(() => {
          applyLayeredLayout(cy, newLayout === 'layered-vertical' ? 'vertical' : 'horizontal');
        });
      } else {
        // Apply standard Cytoscape layout with performance optimizations
        console.log('Applying standard layout:', newLayout);
        const layoutOptions = getOptimizedLayoutOptions(newLayout, isLargeGraph, nodeCount);
        
        debouncedApplyLayout(() => {
          const layout = cy.layout(layoutOptions);
          layout.run();
        });
      }
    }
  };

  const layouts = [
    { name: 'layered-vertical', label: 'Layered (Vertical)' },
    { name: 'layered-horizontal', label: 'Layered (Horizontal)' },
    { name: 'breadthfirst', label: 'Hierarchical' },
    { name: 'cose-bilkent', label: 'Force Directed' },
    { name: 'grid', label: 'Grid' },
    { name: 'circle', label: 'Circle' },
    { name: 'concentric', label: 'Concentric' }
  ];

  return (
    <div className="relative w-full h-full">
      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background border border-border rounded-lg"
        style={{ minHeight: '500px' }}
      />
      
      {/* Main Controls - Top Left Corner */}
      <Card className="absolute top-0 left-0 p-2 bg-card/95 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col gap-2">
          {/* Navigation Controls */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              title="Zoom In"
              className="h-7 w-7 p-0"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="h-7 w-7 p-0"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              title="Reset View"
              className="h-7 w-7 p-0"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              title="Export PNG"
              className="h-7 w-7 p-0"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCSVExport}
              title="Export CSV"
              className="h-7 w-7 p-0 text-xs"
            >
              📊
            </Button>
            {(layoutName === 'layered-vertical' || layoutName === 'layered-horizontal') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('Manual layered layout trigger');
                  applyLayeredLayout(cy, layoutName === 'layered-vertical' ? 'vertical' : 'horizontal');
                }}
                title="Apply Layered Layout"
                className="h-7 w-7 p-0 bg-blue-100 hover:bg-blue-200 text-xs"
              >
                🔄
              </Button>
            )}
          </div>
          
          {/* Layout Selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Layout</label>
            <select
              value={layoutName}
              onChange={(e) => handleLayoutChange(e.target.value)}
              className="text-xs p-1 border border-border rounded bg-background w-full"
              disabled={hypergraphMode !== 'none'}
            >
              {layouts.map(layout => (
                <option key={layout.name} value={layout.name}>
                  {layout.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Graph Mode */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Graph Mode</label>
            <select
              value={hypergraphMode}
              onChange={(e) => handleHypergraphModeChange(e.target.value)}
              className="text-xs p-1 border border-border rounded bg-background w-full"
            >
              <option value="none">Normal Graph</option>
              <option value="basic">Basic Hypergraph</option>
              <option value="community">Community Hypergraph</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Node Visualization Controls - Bottom Right Corner */}
      <Card className="absolute bottom-0 right-0 p-2 bg-card/95 backdrop-blur-sm shadow-lg w-40">
        <div className="space-y-1.5">
          <h5 className="text-xs font-medium text-muted-foreground">Node Style</h5>
          
          {/* Node Size - Compact */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Size</label>
              <span className="text-xs text-muted-foreground">{nodeSize || 20}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              value={nodeSize || 20}
              onChange={(e) => {
                const size = parseInt(e.target.value);
                setNodeSize(size);
                if (cy) {
                  // Recalculate centrality-based sizing with new base size
                  cy.style()
                    .selector('node:not(.hypernode-bg)')
                    .style(getOptimizedNodeStyle(isLargeGraph, betweennessCentrality, size))
                    .update();
                  
                  // Update hypernode sizes to accommodate new node sizes
                  updateHypernodeSizes();
                }
              }}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Font Size - Compact */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Font</label>
              <span className="text-xs text-muted-foreground">{fontSize || 8}px</span>
            </div>
            <input
              type="range"
              min="6"
              max="16"
              value={fontSize || 8}
              onChange={(e) => {
                const size = parseInt(e.target.value);
                setFontSize(size);
                if (cy) {
                  cy.style()
                    .selector('node:not(.hypernode-bg)')
                    .style({
                      'font-size': `${size}px`
                    })
                    .update();
                }
              }}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Reset Button - Compact */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNodeSize(20);
              setFontSize(8);
              if (cy) {
                cy.style()
                  .selector('node:not(.hypernode-bg)')
                  .style(getOptimizedNodeStyle(isLargeGraph, betweennessCentrality, 20))
                  .update();
                
                // Update hypernode sizes after reset
                updateHypernodeSizes();
              }
            }}
            className="w-full text-xs h-6"
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Stats & Performance - Top Right Corner */}
      {data && !showHypernodeTable && (
        <Card className="absolute top-0 right-0 p-1.5 bg-card/95 backdrop-blur-sm shadow-lg">
          <div className="text-xs space-y-1">
            {/* Performance indicator when needed */}
            {isLargeGraph && (
              <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 pb-1 border-b border-border">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                <span>Performance: {nodeCount} nodes</span>
              </div>
            )}
            {/* Stats */}
            <div>
              <div className="font-medium text-muted-foreground mb-0.5">Stats</div>
              <div>Nodes: <span className="font-semibold">{data.nodes?.length || 0}</span></div>
              <div>Edges: <span className="font-semibold">{data.edges?.length || 0}</span></div>
            </div>
          </div>
        </Card>
      )}

      {/* Enhanced Hypernode Details Modal */}
      {showHypernodeTable && selectedHypernode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowHypernodeTable(false)}
        >
            <div className="text-xs text-muted-foreground">
              �️ Hover node → highlight pathway
            </div>
        </div>
      )}

      {/* Enhanced Hypernode Details Modal */}
      {showHypernodeTable && selectedHypernode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHypernodeTable(false);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                📊 {selectedHypernode.label} - Network Analysis
              </h4>
              <button
                onClick={() => setShowHypernodeTable(false)}
                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Hypernode Info and Direct Nodes */}
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <h5 className="font-semibold text-sm mb-2">Hypernode Information</h5>
                    <div className="space-y-1 text-xs">
                      <div><strong>Type:</strong> {selectedHypernode.isMainCluster ? 'Main Cluster' : 'Mini Cluster'}</div>
                      {selectedHypernode.parentCluster && (
                        <div><strong>Category:</strong> {selectedHypernode.parentCluster}</div>
                      )}
                      <div><strong>Clustering Method:</strong> {selectedHypernode.clusteringMethod || 'Basic'}</div>
                      <div><strong>Direct Nodes:</strong> {selectedHypernode.nodes.length}</div>
                      <div><strong>Hypernode ID:</strong> {selectedHypernode.id}</div>
                      {selectedHypernode.radius && (
                        <div><strong>Radius:</strong> {Math.round(selectedHypernode.radius)}px</div>
                      )}
                      {selectedHypernode.position && (
                        <div><strong>Position:</strong> ({Math.round(selectedHypernode.position.x)}, {Math.round(selectedHypernode.position.y)})</div>
                      )}
                      {selectedHypernode.connectedHypernodes && (
                        <div><strong>Connected Hypernodes:</strong> {selectedHypernode.totalConnectedHypernodes || 0}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h5 className="font-semibold text-sm p-3 border-b border-gray-200 dark:border-gray-600">
                      Direct Nodes in Hypernode
                    </h5>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3">Node</th>
                            <th className="text-left py-2 px-3">Type</th>
                            <th className="text-left py-2 px-3">AOP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHypernode.nodes.map((node, index) => (
                            <tr key={index} className="border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="py-2 px-3 max-w-32 truncate" title={node.data('label')}>
                                {node.data('label') || node.data('id')}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                  node.data('type') === 'MolecularInitiatingEvent' ? 'bg-green-500' :
                                  node.data('type') === 'KeyEvent' ? 'bg-blue-500' :
                                  node.data('type') === 'AdverseOutcome' ? 'bg-pink-500' : 'bg-gray-500'
                                }`}></span>
                                {node.data('type') === 'MolecularInitiatingEvent' ? 'MIE' :
                                 node.data('type') === 'KeyEvent' ? 'KE' :
                                 node.data('type') === 'AdverseOutcome' ? 'AO' : 'Other'}
                              </td>
                              <td className="py-2 px-3 max-w-20 truncate" title={node.data('aop')}>
                                {node.data('aop') || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                {/* Connected Hypernodes Section */}
                <div className="space-y-4">
                  {selectedHypernode.connectedHypernodes && selectedHypernode.connectedHypernodes.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <h5 className="font-semibold text-sm p-3 border-b border-gray-200 dark:border-gray-600">
                        🔗 Connected Hypernodes ({selectedHypernode.connectedHypernodes.length})
                      </h5>
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                            <strong>Incoming:</strong> {selectedHypernode.incomingConnections || 0}
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <strong>Outgoing:</strong> {selectedHypernode.outgoingConnections || 0}
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          <div className="space-y-3">
                            {selectedHypernode.connectedHypernodes.map((connection, index) => (
                              <div key={index} className={`border rounded-lg overflow-hidden ${
                                connection.connectionType === 'incoming' ? 'border-green-200 bg-green-50/30 dark:bg-green-900/10' : 'border-blue-200 bg-blue-50/30 dark:bg-blue-900/10'
                              }`}>
                                {/* Hypernode Header */}
                                <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">
                                        {connection.hypernode.isMainCluster ? '🎯' : '🔸'} {connection.hypernode.label}
                                      </span>
                                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                                        connection.connectionType === 'incoming' 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                                      }`}>
                                        {connection.connectionType === 'incoming' ? '⬅️ Incoming' : '➡️ Outgoing'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                        Weight: {connection.weight}
                                      </span>
                                      {connection.isInterCluster ? (
                                        <span className="text-purple-600 dark:text-purple-400">
                                          🔄 {connection.sourceType}→{connection.targetType}
                                        </span>
                                      ) : (
                                        <span className="text-gray-600 dark:text-gray-400">
                                          {connection.hypernode.parentCluster || 'Same Type'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Inner Nodes List */}
                                {connection.hypernode.nodes && connection.hypernode.nodes.length > 0 && (
                                  <div className="p-3">
                                    <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      Inner Nodes ({connection.hypernode.nodes.length}):
                                    </h6>
                                    <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                                      {connection.hypernode.nodes.map((innerNode, nodeIndex) => (
                                        <div key={nodeIndex} className="flex items-center gap-2 text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                          <span className={`inline-block w-2 h-2 rounded-full ${
                                            innerNode.data('type') === 'MolecularInitiatingEvent' ? 'bg-green-500' :
                                            innerNode.data('type') === 'KeyEvent' ? 'bg-blue-500' :
                                            innerNode.data('type') === 'AdverseOutcome' ? 'bg-pink-500' : 'bg-gray-500'
                                          }`}></span>
                                          <span className="font-medium min-w-8">
                                            {innerNode.data('type') === 'MolecularInitiatingEvent' ? 'MIE' :
                                             innerNode.data('type') === 'KeyEvent' ? 'KE' :
                                             innerNode.data('type') === 'AdverseOutcome' ? 'AO' : 'Other'}
                                          </span>
                                          <span className="truncate flex-1" title={innerNode.data('label')}>
                                            {innerNode.data('label') || innerNode.data('id')}
                                          </span>
                                          {innerNode.data('aop') && (
                                            <span className="text-gray-500 text-xs truncate max-w-16" title={innerNode.data('aop')}>
                                              {innerNode.data('aop')}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Close Button */}
              <div className="mt-6 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  onClick={() => setShowHypernodeTable(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;

