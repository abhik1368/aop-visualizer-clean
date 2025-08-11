#!/usr/bin/env python3

import requests
import json

try:
    response = requests.get('http://localhost:5001/aop_graph?aop=Aop:1')
    data = response.json()
    
    print('=== NODES ===')
    for node in data['nodes']:
        print(f'{node["id"]}: {node["type"]} - {node["label"]}')
    
    print('\n=== EDGES ===')  
    for edge in data['edges']:
        edge_type = edge.get("type", "unknown")
        print(f'{edge["source"]} -> {edge["target"]} (type: {edge_type})')
        
    print(f'\nTotal nodes: {len(data["nodes"])}')
    print(f'Total edges: {len(data["edges"])}')
    
    # Check for stressor nodes specifically
    stressor_nodes = [n for n in data['nodes'] if 'STRESSOR' in n['id']]
    print(f'\nStressor nodes: {len(stressor_nodes)}')
    for node in stressor_nodes:
        print(f'  {node["id"]}: {node["label"]}')
        
    # Check for stressor-to-AO edges specifically
    stressor_ao_edges = [e for e in data['edges'] if e.get('type') == 'stressor-to-ao']
    print(f'\nStressor-to-AO edges: {len(stressor_ao_edges)}')
    for edge in stressor_ao_edges:
        print(f'  {edge["source"]} -> {edge["target"]} ({edge.get("label", "")})')

except Exception as e:
    print(f'Error: {e}')
