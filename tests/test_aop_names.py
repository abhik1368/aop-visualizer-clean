#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

import main

print("Testing AOP name loading...")
aop_data = main.load_aop_data()

print(f"Total stressor nodes: {len(aop_data['stressor_nodes'])}")

# Check first few stressor nodes
for i, node in enumerate(aop_data['stressor_nodes'][:5]):
    aop_name = node.get('aop_name', 'NOT_FOUND')
    aop_id = node.get('aop_id', 'NOT_FOUND')
    print(f"Stressor {i}: aop_id='{aop_id}', aop_name='{aop_name}'")
