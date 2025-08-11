#!/usr/bin/env python3
"""
Test script for Event:1282 (JAK/STAT pathway activation) in AOP:208
to verify all connected events are included in Key Event search
"""

import requests
import json

def test_event_1282():
    """Test Key Event search for Event:1282"""
    
    # Backend URL
    url = "http://localhost:5001/key_event_search"
    
    # Test data - Event:1282 (JAK/STAT pathway activation)
    test_data = {
        "keyEvents": ["Event:1282"]
    }
    
    print(f"Testing Key Event search for Event:1282 (JAK/STAT pathway)")
    print(f"Request: {test_data}")
    
    try:
        response = requests.post(url, json=test_data)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ SUCCESS: Key Event search completed")
            print(f"Total nodes found: {len(result.get('nodes', []))}")
            print(f"Total edges found: {len(result.get('edges', []))}")
            print(f"Affected AOPs: {result.get('affected_aops', [])}")
            
            # Check for AOP:208 events specifically
            aop_208_events = []
            print(f"\n📋 All nodes found:")
            for node in result.get('nodes', []):
                print(f"  - {node.get('id')} ({node.get('type', 'Unknown')}) - {node.get('label', 'No label')} [AOP: {node.get('aop')}]")
                if node.get('aop') == 'Aop:208':
                    aop_208_events.append(node.get('id'))
            
            print(f"\n🎯 AOP:208 events found: {aop_208_events}")
            
            # Expected events in AOP:208
            expected_events = ["Event:1282", "Event:1283", "Event:1277"]
            print(f"Expected events in AOP:208: {expected_events}")
            
            # Verify all expected events are present
            missing_events = [event for event in expected_events if event not in aop_208_events]
            if missing_events:
                print(f"❌ MISSING events: {missing_events}")
            else:
                print(f"✅ ALL expected AOP:208 events found!")
                
            # Check for edges
            print(f"\n🔗 Edges found:")
            for edge in result.get('edges', []):
                print(f"  - {edge.get('source')} -> {edge.get('target')} [AOP: {edge.get('aop')}]")
            
            return True
            
        else:
            print(f"❌ ERROR: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        return False

def test_get_key_events():
    """Test getting all available key events"""
    print(f"\n" + "="*60)
    print(f"Testing /key_events endpoint")
    
    try:
        response = requests.get("http://localhost:5001/key_events")
        
        if response.status_code == 200:
            key_events = response.json()
            print(f"✅ Found {len(key_events)} total key events")
            
            # Look for Event:1282 specifically
            event_1282 = None
            for ke in key_events:
                if ke.get('id') == 'Event:1282':
                    event_1282 = ke
                    break
            
            if event_1282:
                print(f"✅ Found Event:1282: {event_1282}")
            else:
                print(f"❌ Event:1282 not found in key events list")
                
        else:
            print(f"❌ ERROR: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")

if __name__ == "__main__":
    print("="*60)
    print("Testing Key Event Search for AOP:208 Event:1282")
    print("="*60)
    
    test_get_key_events()
    
    print(f"\n" + "="*60)
    print(f"Testing Key Event Search")
    
    success = test_event_1282()
    
    print(f"\n" + "="*60)
    if success:
        print("✅ Test completed successfully!")
    else:
        print("❌ Test failed!")
    print("="*60)
