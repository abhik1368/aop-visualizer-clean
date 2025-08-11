#!/usr/bin/env python3
"""
Quick test to identify the 500 error and missing Event:1282
"""

import requests
import json

def test_basic_endpoints():
    """Test basic endpoints"""
    print("🔍 Testing basic endpoints...")
    
    # Test 1: Server health
    try:
        response = requests.get("http://localhost:5001/aops")
        print(f"AOPs endpoint: {response.status_code} - {len(response.json()) if response.status_code == 200 else 'Error'}")
    except Exception as e:
        print(f"AOPs endpoint ERROR: {e}")
    
    # Test 2: Key events
    try:
        response = requests.get("http://localhost:5001/key_events")
        if response.status_code == 200:
            data = response.json()
            key_events = data.get('key_events', [])
            print(f"Key events endpoint: {response.status_code} - {len(key_events)} events")
            
            # Check for Event:1282 and Event:1715
            event_1282 = next((ke for ke in key_events if ke.get('id') == 'Event:1282'), None)
            event_1715 = next((ke for ke in key_events if ke.get('id') == 'Event:1715'), None)
            
            print(f"Event:1282 found: {'✅' if event_1282 else '❌'}")
            print(f"Event:1715 found: {'✅' if event_1715 else '❌'}")
            
            if event_1282:
                print(f"Event:1282 details: {event_1282}")
            if event_1715:
                print(f"Event:1715 details: {event_1715}")
                
            # Show first few events
            print(f"First 5 events: {[ke.get('id') for ke in key_events[:5]]}")
            
        else:
            print(f"Key events endpoint ERROR: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Key events endpoint ERROR: {e}")

def test_key_event_search(event_id):
    """Test key event search for specific event"""
    print(f"\n🔍 Testing key event search for {event_id}...")
    
    try:
        response = requests.post("http://localhost:5001/key_event_search", 
                               json={"keyEvents": [event_id]})
        
        print(f"Search response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success: {len(result.get('nodes', []))} nodes, {len(result.get('edges', []))} edges")
            print(f"Affected AOPs: {result.get('affected_aops', [])}")
            
            # Show nodes by AOP
            nodes_by_aop = {}
            for node in result.get('nodes', []):
                aop = node.get('aop', 'Unknown')
                if aop not in nodes_by_aop:
                    nodes_by_aop[aop] = []
                nodes_by_aop[aop].append(f"{node.get('id')} ({node.get('type')})")
            
            for aop, nodes in nodes_by_aop.items():
                print(f"  {aop}: {nodes}")
                
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    print("🚀 Quick Diagnostic Test")
    print("=" * 50)
    
    test_basic_endpoints()
    
    print("\n" + "=" * 50)
    test_key_event_search("Event:1715")  # The failing one
    
    print("\n" + "=" * 50)
    test_key_event_search("Event:1282")  # The missing one
    
    print("\n" + "=" * 50)
    print("🏁 Test Complete")
