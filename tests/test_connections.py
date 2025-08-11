#!/usr/bin/env python3
"""
Simple test to verify stressor hypernode connections
"""
import sys
import os
sys.path.append('src')

import requests
import json

def test_hypergraph_connections():
    print("=== TESTING HYPERGRAPH CONNECTIONS ===")
    
    # Test the hypergraph API directly
    url = "http://localhost:5001/hypergraph"
    params = {
        'aop_ids': '1',
        'use_type_groups': 'true',
        'use_communities': 'false',
        'min_nodes': '1'
    }
    
    try:
        response = requests.get(url, params=params)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check hypernodes
            hypernodes = [n for n in data.get('nodes', []) if n.get('type') in ['type-hypernode', 'stressor-hypernode']]
            stressor_hypernodes = [n for n in hypernodes if n.get('type') == 'stressor-hypernode']
            type_hypernodes = [n for n in hypernodes if n.get('type') == 'type-hypernode']
            
            print(f"Total hypernodes: {len(hypernodes)}")
            print(f"Stressor hypernodes: {len(stressor_hypernodes)}")
            print(f"Type hypernodes: {len(type_hypernodes)}")
            
            # Check connections
            hypernode_connections = [e for e in data.get('edges', []) if e.get('type') == 'stressor-hypernode-connection']
            print(f"Stressor hypernode connections: {len(hypernode_connections)}")
            
            if hypernode_connections:
                print("Found stressor connections:")
                for conn in hypernode_connections:
                    print(f"  - {conn.get('source')} → {conn.get('target')} (label: {conn.get('label')})")
            else:
                print("❌ No stressor hypernode connections found!")
                
            # List all stressor hypernodes
            if stressor_hypernodes:
                print("Stressor hypernodes found:")
                for hn in stressor_hypernodes:
                    print(f"  - {hn.get('id')}: {hn.get('label')} (AOP: {hn.get('aop')})")
            else:
                print("❌ No stressor hypernodes found!")
                
        else:
            print(f"❌ API request failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing connections: {e}")

if __name__ == "__main__":
    test_hypergraph_connections()
