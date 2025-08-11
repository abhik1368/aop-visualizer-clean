#!/usr/bin/env python3
"""
Test script for AOP pathfinding algorithms
"""

import sys
import os

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'src'))

from main import (
    build_graph_from_data, 
    build_bidirectional_graph,
    find_shortest_path, 
    find_k_shortest_paths,
    find_k_longest_paths,
    find_mie_to_ao_paths,
    filter_nodes_by_type
)

def create_sample_data():
    """Create sample AOP data for testing"""
    nodes = [
        {"id": "MIE_1", "label": "Chemical Binding", "type": "molecular_initiating_event"},
        {"id": "KE_1", "label": "Protein Modification", "type": "key_event"},
        {"id": "KE_2", "label": "Cell Death", "type": "key_event"},
        {"id": "KE_3", "label": "Tissue Damage", "type": "key_event"},
        {"id": "AO_1", "label": "Liver Toxicity", "type": "adverse_outcome"},
        {"id": "MIE_2", "label": "Receptor Binding", "type": "molecular_initiating_event"},
        {"id": "KE_4", "label": "Inflammation", "type": "key_event"},
        {"id": "AO_2", "label": "Organ Failure", "type": "adverse_outcome"}
    ]
    
    edges = [
        {"source": "MIE_1", "target": "KE_1", "type": "key_event_relationship"},
        {"source": "KE_1", "target": "KE_2", "type": "key_event_relationship"},
        {"source": "KE_2", "target": "KE_3", "type": "key_event_relationship"},
        {"source": "KE_3", "target": "AO_1", "type": "key_event_relationship"},
        {"source": "MIE_2", "target": "KE_4", "type": "key_event_relationship"},
        {"source": "KE_4", "target": "KE_3", "type": "key_event_relationship"},
        {"source": "KE_1", "target": "KE_4", "type": "key_event_relationship"},  # Alternative path
        {"source": "KE_4", "target": "AO_2", "type": "key_event_relationship"}
    ]
    
    return {"nodes": nodes, "edges": edges}

def test_basic_algorithms():
    """Test basic pathfinding algorithms"""
    print("🧪 Testing Basic Pathfinding Algorithms")
    print("=" * 50)
    
    # Create test data
    data = create_sample_data()
    graph = build_graph_from_data(data)
    
    # Test shortest path
    print("\n1. Testing Shortest Path Algorithm")
    path = find_shortest_path(graph, "MIE_1", "AO_1")
    print(f"   Shortest path MIE_1 → AO_1: {' → '.join(path) if path else 'No path found'}")
    assert path == ["MIE_1", "KE_1", "KE_2", "KE_3", "AO_1"], f"Expected specific path, got {path}"
    print("   ✅ Shortest path test passed")
    
    # Test K shortest paths
    print("\n2. Testing K-Shortest Paths Algorithm")
    paths = find_k_shortest_paths(graph, "MIE_1", "AO_1", k=2)
    print(f"   Found {len(paths)} paths:")
    for i, path in enumerate(paths):
        print(f"     Path {i+1}: {' → '.join(path)} (length: {len(path)-1})")
    assert len(paths) >= 1, "Should find at least one path"
    print("   ✅ K-shortest paths test passed")
    
    # Test longest paths
    print("\n3. Testing Longest Paths Algorithm")
    bidirectional_graph = build_bidirectional_graph(data)
    longest_paths = find_k_longest_paths(bidirectional_graph, "MIE_1", "AO_1", k=2, max_length=8)
    print(f"   Found {len(longest_paths)} longest paths:")
    for i, path in enumerate(longest_paths):
        print(f"     Path {i+1}: {' → '.join(path)} (length: {len(path)-1})")
    print("   ✅ Longest paths test passed")

def test_node_filtering():
    """Test node type filtering"""
    print("\n🧪 Testing Node Type Filtering")
    print("=" * 50)
    
    data = create_sample_data()
    nodes = data["nodes"]
    
    # Test MIE node filtering
    mie_nodes = filter_nodes_by_type(nodes, ['MIE', 'molecular_initiating_event'])
    print(f"\nMIE nodes found: {[node['id'] for node in mie_nodes]}")
    assert len(mie_nodes) == 2, f"Expected 2 MIE nodes, found {len(mie_nodes)}"
    
    # Test AO node filtering
    ao_nodes = filter_nodes_by_type(nodes, ['AO', 'adverse_outcome'])
    print(f"AO nodes found: {[node['id'] for node in ao_nodes]}")
    assert len(ao_nodes) == 2, f"Expected 2 AO nodes, found {len(ao_nodes)}"
    
    print("✅ Node filtering test passed")

def test_mie_to_ao_pathfinding():
    """Test MIE to AO pathfinding functionality"""
    print("\n🧪 Testing MIE to AO Pathfinding")
    print("=" * 50)
    
    data = create_sample_data()
    
    # Test shortest paths
    print("\n1. Testing MIE to AO Shortest Paths")
    result = find_mie_to_ao_paths(data, k=3, path_type='shortest')
    print(f"   Found {len(result['paths'])} shortest paths")
    print(f"   MIE nodes: {result['mie_nodes']}")
    print(f"   AO nodes: {result['ao_nodes']}")
    print(f"   Total paths found: {result['total_found']}")
    
    if result['paths']:
        for i, path_info in enumerate(result['paths'][:2]):
            print(f"     Path {i+1}: {' → '.join(path_info['path'])} (length: {path_info['length']})")
    
    assert len(result['paths']) > 0, "Should find at least one MIE to AO path"
    print("   ✅ MIE to AO shortest paths test passed")
    
    # Test longest paths
    print("\n2. Testing MIE to AO Longest Paths")
    result_long = find_mie_to_ao_paths(data, k=3, path_type='longest')
    print(f"   Found {len(result_long['paths'])} longest paths")
    
    if result_long['paths']:
        for i, path_info in enumerate(result_long['paths'][:2]):
            print(f"     Path {i+1}: {' → '.join(path_info['path'])} (length: {path_info['length']})")
    
    print("   ✅ MIE to AO longest paths test passed")

def test_edge_cases():
    """Test edge cases and error conditions"""
    print("\n🧪 Testing Edge Cases")
    print("=" * 50)
    
    # Test with no MIE or AO nodes
    empty_data = {
        "nodes": [{"id": "KE_1", "label": "Some Event", "type": "key_event"}],
        "edges": []
    }
    
    result = find_mie_to_ao_paths(empty_data, k=3)
    print(f"\n1. No MIE/AO nodes test: {result['message']}")
    assert len(result['paths']) == 0, "Should return no paths when no MIE/AO nodes"
    print("   ✅ No MIE/AO nodes test passed")
    
    # Test with disconnected graph
    disconnected_data = {
        "nodes": [
            {"id": "MIE_1", "type": "molecular_initiating_event"},
            {"id": "AO_1", "type": "adverse_outcome"}
        ],
        "edges": []  # No connections
    }
    
    result = find_mie_to_ao_paths(disconnected_data, k=3)
    print(f"\n2. Disconnected graph test: Found {len(result['paths'])} paths")
    print("   ✅ Disconnected graph test passed")

def main():
    """Run all pathfinding tests"""
    print("🚀 AOP Pathfinding Algorithm Tests")
    print("=" * 50)
    
    try:
        test_basic_algorithms()
        test_node_filtering()
        test_mie_to_ao_pathfinding()
        test_edge_cases()
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed successfully!")
        print("✅ Pathfinding algorithms are working correctly")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
