# AOP Network Pathfinding System

## Overview

The AOP Network Visualizer now includes a comprehensive pathfinding system that allows users to discover and analyze pathways between nodes, with a special focus on Molecular Initiating Events (MIE) to Adverse Outcomes (AO) pathways.

## Features

### 1. MIE to AO Pathfinding
- **Automatic Discovery**: Finds all available MIE and AO nodes in the selected AOP
- **Multiple Path Types**: 
  - **Shortest Paths**: Find the most direct routes between MIE and AO nodes
  - **Longest Paths**: Discover comprehensive pathways that include more intermediate nodes
- **Top-K Results**: Configurable number of paths to return (K = 1, 2, 3, etc.)
- **Hypergraph Visualization**: Option to group results into hypernodes for cleaner visualization

### 2. Custom Pathfinding
- **Source/Target Selection**: Choose any two nodes for pathfinding
- **Flexible Node Types**: Works with any node types in the AOP network
- **K-shortest Paths**: Find multiple alternative routes between selected nodes

### 3. Hypergraph Integration
- **Automatic Grouping**: Path results can be automatically grouped into hypernodes
- **Type-based Organization**: Nodes are grouped by their biological function/type
- **Configurable Splitting**: Control maximum nodes per hypernode (default: 4)
- **Clean Visualization**: Reduces visual complexity while maintaining pathway information

## API Endpoints

### `/mie_to_ao_paths`
Find pathways from MIE nodes to AO nodes with optional hypergraph visualization.

**Parameters:**
- `aop` (string): AOP identifier (e.g., "Aop:1")
- `k` (int): Number of paths to return (default: 3)
- `type` (string): Path type - "shortest" or "longest" (default: "shortest")
- `hypergraph` (boolean): Enable hypergraph visualization (default: true)
- `max_per_hypernode` (int): Maximum nodes per hypernode (default: 4)

**Response:**
```json
{
  "paths": [
    {
      "mie_node": "MIE_ID",
      "ao_node": "AO_ID", 
      "path": ["node1", "node2", "node3"],
      "length": 2,
      "edges": [...]
    }
  ],
  "graph_data": {...},
  "hypergraph_data": {...},
  "mie_nodes": ["MIE1", "MIE2"],
  "ao_nodes": ["AO1", "AO2"],
  "total_found": 10
}
```

### Enhanced Existing Endpoints

#### `/shortest_path`
- Find single shortest path between two specific nodes
- Enhanced with better error handling and edge information

#### `/k_shortest_paths` 
- Find K shortest paths between two specific nodes
- Improved algorithm for better path diversity

#### `/all_paths`
- Find paths between different node types
- Enhanced filtering and organization

## Frontend Integration

### PathfindingPanel Component
- **Intuitive Interface**: Easy-to-use controls for pathfinding configuration
- **Mode Selection**: Switch between MIE-to-AO and custom pathfinding
- **Real-time Results**: Display paths with lengths and intermediate nodes
- **Visualization Integration**: Seamless integration with network and hypergraph views

### UI Features
- **Dedicated Tab**: Pathfinding has its own tab in the right panel
- **Visual Feedback**: Loading states, error messages, and success indicators
- **Path Highlighting**: Results are automatically visualized in the network
- **Hypergraph Toggle**: Easy switching between regular and hypergraph views

## Usage Examples

### 1. Find MIE to AO Shortest Paths
```javascript
// Using the frontend interface:
// 1. Select "MIE to AO Paths" mode
// 2. Choose "Shortest Paths"
// 3. Set K = 3 for top 3 paths
// 4. Enable hypergraph visualization
// 5. Click "Find Paths"
```

### 2. Find Custom Node Paths
```javascript
// Using the frontend interface:
// 1. Select "Custom Source/Target" mode
// 2. Choose source and target nodes from dropdowns
// 3. Set desired number of paths
// 4. Click "Find Paths"
```

### 3. API Usage
```python
import requests

# Find MIE to AO paths with hypergraph
response = requests.get("http://localhost:5001/mie_to_ao_paths", {
    "aop": "Aop:1",
    "k": 5,
    "type": "shortest",
    "hypergraph": "true",
    "max_per_hypernode": 4
})

data = response.json()
print(f"Found {len(data['paths'])} pathways")
```

## Algorithm Details

### Shortest Path Algorithm
- **Method**: Breadth-First Search (BFS)
- **Guarantees**: Finds truly shortest paths in unweighted graphs
- **Performance**: O(V + E) time complexity
- **Cycle Prevention**: Avoids infinite loops in cyclic graphs

### Longest Path Algorithm  
- **Method**: Depth-First Search (DFS) with length limiting
- **Purpose**: Discover comprehensive pathways with more intermediate steps
- **Safety**: Maximum path length limit prevents infinite loops
- **Use Case**: Understanding complex multi-step biological processes

### Hypergraph Creation
- **Type-based Grouping**: Nodes grouped by biological function
- **Smart Splitting**: Large groups split based on max_per_hypernode parameter
- **Edge Preservation**: Maintains connectivity information between hypernodes
- **MIE-AO Focus**: Special handling for MIE to AO pathway visualization

## Performance Considerations

### Optimization Features
- **Node Limiting**: Limits source/target combinations to prevent exponential growth
- **Path Limiting**: Configurable maximum paths to control result size
- **Cycle Detection**: Prevents infinite loops in path discovery
- **Memory Management**: Efficient data structures for large graphs

### Scalability
- **Large AOPs**: Handles networks with thousands of nodes efficiently
- **Multiple Paths**: Efficiently finds multiple alternative pathways
- **Real-time Processing**: Fast enough for interactive use
- **Resource Management**: Bounded memory usage even for complex networks

## Integration with Existing Features

### Hypergraph System
- **Seamless Integration**: Pathfinding results integrate with existing hypergraph features
- **Type-based Grouping**: Uses the same grouping logic as main hypergraph system
- **Visualization Consistency**: Same styling and interaction patterns

### Node Selection
- **Chain Building**: Results can contribute to node selection chains
- **Details Panel**: Path nodes can be selected for detailed information
- **Analysis Integration**: Path results can be analyzed with AI analysis features

## Future Enhancements

### Planned Features
- **Path Scoring**: Biological relevance scoring for paths
- **Path Comparison**: Side-by-side comparison of multiple pathways
- **Export Options**: Export pathways in various formats
- **Advanced Filtering**: Filter paths by node types, biological processes
- **Pathway Enrichment**: Integration with pathway databases

### Visualization Improvements
- **Path Animation**: Animated visualization of pathway progression
- **Path Highlighting**: Better visual distinction of different paths
- **Interactive Exploration**: Click-to-explore path segments
- **3D Visualization**: Optional 3D view for complex pathways

This pathfinding system provides a powerful tool for understanding the biological pathways and relationships within AOP networks, making complex pathway analysis accessible and intuitive.
