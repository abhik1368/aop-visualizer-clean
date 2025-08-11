#!/usr/bin/env python3
"""
Test the new full database pathfinding functionality
"""

import requests
import json

BASE_URL = "http://localhost:5001"

def test_full_database_nodes():
    """Test getting all nodes from the full database"""
    print("🧪 Testing Full Database Nodes Endpoint")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/full_database_nodes")
        data = response.json()
        
        print(f"✅ Total nodes in database: {data['total_nodes']:,}")
        print(f"✅ Node types available: {len(data['node_type_counts'])}")
        
        # Show node type breakdown
        print("\n📊 Node Type Breakdown:")
        for node_type, count in sorted(data['node_type_counts'].items()):
            print(f"   {node_type}: {count} nodes")
        
        # Show some example nodes
        print(f"\n🔍 Sample nodes (first 5):")
        for i, node in enumerate(data['nodes'][:5]):
            print(f"   {i+1}. {node['id']} ({node['type']}) - {node['label']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_mie_to_ao_full_database():
    """Test MIE to AO pathfinding on full database"""
    print("\n🧪 Testing MIE to AO Pathfinding (Full Database)")
    print("=" * 50)
    
    try:
        params = {
            'k': 3,
            'type': 'shortest',
            'hypergraph': 'true',
            'max_per_hypernode': 4,
            'full_database': 'true'
        }
        
        response = requests.get(f"{BASE_URL}/mie_to_ao_paths", params=params)
        data = response.json()
        
        if 'error' in data:
            print(f"❌ Error: {data['error']}")
            return False
        
        print(f"✅ Found {len(data['paths'])} pathways")
        print(f"✅ Database stats:")
        stats = data.get('database_stats', {})
        print(f"   Total nodes: {stats.get('total_nodes', 'N/A')}")
        print(f"   Total edges: {stats.get('total_edges', 'N/A')}")
        print(f"   MIE nodes: {stats.get('mie_nodes', 'N/A')}")
        print(f"   AO nodes: {stats.get('ao_nodes', 'N/A')}")
        print(f"   Used full database: {stats.get('used_full_database', 'N/A')}")
        
        # Show first few paths
        print(f"\n🛤️ Sample pathways:")
        for i, path in enumerate(data['paths'][:3]):
            print(f"   Path {i+1}: {path['mie_node']} → {path['ao_node']}")
            print(f"      Route: {' → '.join(path['path'])}")
            print(f"      Length: {path['length']} steps")
        
        print(f"✅ Graph data: {len(data.get('graph_data', {}).get('nodes', []))} nodes, {len(data.get('graph_data', {}).get('edges', []))} edges")
        print(f"✅ Hypergraph data available: {'Yes' if data.get('hypergraph_data') else 'No'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_custom_path_search():
    """Test custom source-target pathfinding"""
    print("\n🧪 Testing Custom Path Search")
    print("=" * 50)
    
    try:
        # First get some nodes to test with
        nodes_response = requests.get(f"{BASE_URL}/full_database_nodes")
        nodes_data = nodes_response.json()
        
        # Find some MIE and AO nodes for testing
        mie_nodes = [node for node in nodes_data['nodes'] if 'mie' in node['type'].lower() or 'molecular' in node['type'].lower()]
        ao_nodes = [node for node in nodes_data['nodes'] if 'ao' in node['type'].lower() or 'adverse' in node['type'].lower()]
        
        if not mie_nodes or not ao_nodes:
            print("❌ Could not find MIE or AO nodes for testing")
            return False
        
        source_node = mie_nodes[0]['id']
        target_node = ao_nodes[0]['id']
        
        print(f"🎯 Testing path: {source_node} → {target_node}")
        
        params = {
            'source': source_node,
            'target': target_node,
            'k': 2,
            'type': 'shortest',
            'hypergraph': 'true',
            'max_per_hypernode': 4
        }
        
        response = requests.get(f"{BASE_URL}/custom_path_search", params=params)
        data = response.json()
        
        if 'error' in data:
            print(f"❌ Error: {data['error']}")
            return False
        
        print(f"✅ Found {len(data['paths'])} custom paths")
        
        # Show paths
        for i, path in enumerate(data['paths']):
            print(f"   Path {i+1}: {path['source_node']} → {path['target_node']}")
            print(f"      Route: {' → '.join(path['path'])}")
            print(f"      Length: {path['length']} steps")
        
        print(f"✅ Graph data: {len(data.get('graph_data', {}).get('nodes', []))} nodes, {len(data.get('graph_data', {}).get('edges', []))} edges")
        print(f"✅ Hypergraph data available: {'Yes' if data.get('hypergraph_data') else 'No'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 AOP Full Database Pathfinding Tests")
    print("=" * 60)
    
    tests_passed = 0
    total_tests = 3
    
    if test_full_database_nodes():
        tests_passed += 1
    
    if test_mie_to_ao_full_database():
        tests_passed += 1
    
    if test_custom_path_search():
        tests_passed += 1
    
    print("\n" + "=" * 60)
    print(f"🎯 Tests Results: {tests_passed}/{total_tests} passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! Full database pathfinding is working!")
    else:
        print("⚠️ Some tests failed. Check the backend server and endpoints.")

if __name__ == "__main__":
    main()
