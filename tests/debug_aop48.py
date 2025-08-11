#!/usr/bin/env python3
"""
Debug script to test AOP48 stressor-MIE connections
"""
import sys
import os
sys.path.append('src')

from main import app, aop_graph_data
from hypergraph_utils import create_hypergraph
import logging

# Set up logging to see debug output
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

def debug_aop48():
    print("=== DEBUGGING AOP48 STRESSOR-MIE CONNECTIONS ===")
    
    # Get AOP48 data
    if not aop_graph_data:
        print("❌ No AOP graph data loaded")
        return
    
    # Filter for AOP48 nodes
    aop48_nodes = [n for n in aop_graph_data['nodes'] if '48' in str(n.get('aop', '') or n.get('aop_id', ''))]
    aop48_edges = [e for e in aop_graph_data['edges'] if 
                   any(n['id'] == e['source'] for n in aop48_nodes) and 
                   any(n['id'] == e['target'] for n in aop48_nodes)]
    
    print(f"Found {len(aop48_nodes)} AOP48 nodes:")
    for node in aop48_nodes:
        aop_val = node.get('aop', '') or node.get('aop_id', '')
        print(f"  - {node.get('type', 'Unknown')}: {node.get('label', node.get('id'))} (AOP: '{aop_val}')")
    
    # Check stressor nodes specifically
    stressor_nodes = [n for n in aop48_nodes if n.get('type') == 'Stressor']
    mie_nodes = [n for n in aop48_nodes if n.get('type') in ['MIE', 'MolecularInitiatingEvent']]
    
    print(f"\nStressor nodes: {len(stressor_nodes)}")
    for s in stressor_nodes:
        print(f"  - {s.get('label', s.get('id'))} (AOP: '{s.get('aop', '') or s.get('aop_id', '')}')")
    
    print(f"\nMIE nodes: {len(mie_nodes)}")
    for m in mie_nodes:
        print(f"  - {m.get('label', m.get('id'))} (AOP: '{m.get('aop', '') or m.get('aop_id', '')}')")
    
    # Test hypergraph creation
    print(f"\n=== TESTING HYPERGRAPH CREATION ===")
    try:
        result = create_hypergraph(
            aop48_nodes,
            aop48_edges,
            min_nodes=1,
            use_communities=False,
            use_type_groups=True,
            exclude_stressor_hypernodes=False
        )
        
        print(f"Created {len(result['hypernodes'])} hypernodes")
        print(f"Created {len(result['hypernode_connections'])} hypernode connections")
        
        # Check for stressor hypernodes
        stressor_hypernodes = [hn for hn in result['hypernodes'] if 'Stressor' in hn.get('id', '')]
        print(f"\nStressor hypernodes: {len(stressor_hypernodes)}")
        for sh in stressor_hypernodes:
            print(f"  - {sh.get('id')} with {len(sh.get('members', []))} members")
        
        # Check connections from stressor hypernodes
        stressor_connections = [conn for conn in result['hypernode_connections'] 
                              if any(sh['id'] == conn.get('source') for sh in stressor_hypernodes)]
        print(f"\nStressor hypernode connections: {len(stressor_connections)}")
        for conn in stressor_connections:
            print(f"  - {conn.get('source')} → {conn.get('target')} ({conn.get('type', 'unknown')})")
        
    except Exception as e:
        print(f"❌ Error creating hypergraph: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_aop48()
