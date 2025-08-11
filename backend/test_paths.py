#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.main import find_k_shortest_paths, path_similarity, is_path_unique, load_aop_data, unified_graph_data, build_graph_from_data

def test_algorithm():
    print("Testing K-Shortest Paths Algorithm")
    print("=" * 50)
    
    # Test with a simple known graph
    test_graph = {
        'A': ['B', 'C'],
        'B': ['D', 'E'],
        'C': ['D', 'F'],
        'D': ['G'],
        'E': ['G'],
        'F': ['G'],
        'G': []
    }
    
    print("Test Graph Structure:")
    for node, neighbors in test_graph.items():
        print(f"  {node} -> {neighbors}")
    
    print("\nFinding 3 paths from A to G:")
    paths = find_k_shortest_paths(test_graph, 'A', 'G', 3)
    
    print(f"\nFound {len(paths)} unique paths:")
    for i, path in enumerate(paths):
        print(f"  Path {i+1}: {' -> '.join(path)} (length: {len(path)-1})")
    
    # Test path similarity
    if len(paths) >= 2:
        sim = path_similarity(paths[0], paths[1])
        print(f"\nSimilarity between path 1 and 2: {sim:.3f}")
    
    print("\n" + "="*50)
    print("Testing with Real AOP Data")
    
    # Load real AOP data
    print("Loading AOP data...")
    load_aop_data()
    
    if unified_graph_data and unified_graph_data.get('nodes'):
        print(f"Loaded {len(unified_graph_data['nodes'])} nodes and {len(unified_graph_data['edges'])} edges")
        
        # Find some nodes to test with
        nodes = unified_graph_data['nodes']
        
        # Look for specific nodes mentioned by user
        source_node = None
        target_node = None
        
        for node in nodes:
            if 'ahr' in node.get('label', '').lower() and 'activation' in node.get('label', '').lower():
                source_node = node['id']
                print(f"Found potential source: {node['id']} - {node.get('label', '')}")
            elif 'liver' in node.get('label', '').lower() and 'fibrosis' in node.get('label', '').lower():
                target_node = node['id']
                print(f"Found potential target: {node['id']} - {node.get('label', '')}")
        
        if source_node and target_node:
            print(f"\nTesting with real data: {source_node} -> {target_node}")
            
            graph = build_graph_from_data(unified_graph_data, bidirectional=False)
            real_paths = find_k_shortest_paths(graph, source_node, target_node, 3)
            
            print(f"Found {len(real_paths)} paths:")
            for i, path in enumerate(real_paths):
                print(f"  Path {i+1}: {len(path)} nodes")
                print(f"    {' -> '.join(path[:3])}...{' -> '.join(path[-3:]) if len(path) > 3 else ''}")
                
            # Check similarities
            if len(real_paths) >= 2:
                for i in range(len(real_paths)):
                    for j in range(i+1, len(real_paths)):
                        sim = path_similarity(real_paths[i], real_paths[j])
                        shared = set(real_paths[i]).intersection(set(real_paths[j]))
                        print(f"  Similarity Path {i+1} vs {j+1}: {sim:.3f} ({len(shared)} shared nodes)")
        else:
            print("Could not find specific source/target nodes for testing")
            # Use first available nodes
            if len(nodes) >= 2:
                source_node = nodes[0]['id']
                target_node = nodes[-1]['id']
                print(f"Using first/last nodes: {source_node} -> {target_node}")
    else:
        print("No AOP data loaded")

if __name__ == "__main__":
    test_algorithm()
