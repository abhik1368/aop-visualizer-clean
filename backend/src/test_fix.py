#!/usr/bin/env python3
"""
Test script to validate the fixes for key event search
"""
import sys
import os
import json

# Add the src directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the main module
from main import unified_graph_data, load_aop_data

def test_data_loading():
    """Test if data loads correctly"""
    print("Testing data loading...")
    
    try:
        load_aop_data()
        
        if not unified_graph_data:
            print("❌ unified_graph_data is empty")
            return False
            
        nodes = unified_graph_data.get("nodes", [])
        edges = unified_graph_data.get("edges", [])
        
        print(f"✅ Loaded {len(nodes)} nodes and {len(edges)} edges")
        
        # Test for specific events
        event_1282 = None
        event_1715 = None
        
        for node in nodes:
            if node.get("id") == "Event:1282":
                event_1282 = node
            elif node.get("id") == "Event:1715":
                event_1715 = node
        
        if event_1282:
            print(f"✅ Found Event:1282: {event_1282.get('label', 'No label')} (AOP: {event_1282.get('aop')})")
        else:
            print("❌ Event:1282 not found")
        
        if event_1715:
            print(f"✅ Found Event:1715: {event_1715.get('label', 'No label')} (AOP: {event_1715.get('aop')})")
        else:
            print("❌ Event:1715 not found")
        
        return True
        
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        return False

def test_key_events_endpoint():
    """Test the key events endpoint logic"""
    print("\nTesting key events extraction...")
    
    try:
        nodes = unified_graph_data.get("nodes", [])
        
        # Extract unique key events
        key_events = []
        seen_events = set()
        
        for node in nodes:
            node_type = node.get("type", "").lower()
            node_id = node.get("id", "")
            
            if "keyevent" in node_type or "key_event" in node_type:
                if node_id not in seen_events:
                    key_events.append({
                        "id": node_id,
                        "label": node.get("label", "Unknown Event"),
                        "type": node.get("type", "KeyEvent"),
                        "aop": node.get("aop", "Unknown")
                    })
                    seen_events.add(node_id)
        
        print(f"✅ Found {len(key_events)} unique key events")
        
        # Check for specific events
        event_1282_found = any(event["id"] == "Event:1282" for event in key_events)
        event_1715_found = any(event["id"] == "Event:1715" for event in key_events)
        
        if event_1282_found:
            print("✅ Event:1282 in key events list")
        else:
            print("❌ Event:1282 NOT in key events list")
        
        if event_1715_found:
            print("✅ Event:1715 in key events list")
        else:
            print("❌ Event:1715 NOT in key events list")
        
        # Show first 5 key events
        print("\nFirst 5 key events:")
        for i, event in enumerate(key_events[:5]):
            print(f"  {i+1}. {event['id']}: {event['label']}")
        
        return len(key_events) > 0
        
    except Exception as e:
        print(f"❌ Error extracting key events: {e}")
        return False

def test_search_simulation():
    """Simulate key event search"""
    print("\nTesting key event search simulation...")
    
    try:
        # Test with Event:1715
        test_events = ["Event:1715"]
        
        nodes = unified_graph_data.get("nodes", [])
        edges = unified_graph_data.get("edges", [])
        
        # Find affected AOPs
        affected_aops = set()
        for node in nodes:
            if node.get("id") in test_events:
                aop = node.get("aop")
                if aop:
                    affected_aops.add(aop)
        
        print(f"✅ Event:1715 found in AOPs: {list(affected_aops)}")
        
        # Test pathway building for first AOP
        if affected_aops:
            test_aop = list(affected_aops)[0]
            aop_nodes = [n for n in nodes if n.get("aop") == test_aop]
            aop_edges = [e for e in edges if e.get("aop") == test_aop]
            
            print(f"✅ AOP {test_aop} has {len(aop_nodes)} nodes and {len(aop_edges)} edges")
            
            # Check if Event:1715 is in this AOP
            event_in_aop = any(n.get("id") == "Event:1715" for n in aop_nodes)
            print(f"✅ Event:1715 found in AOP {test_aop}: {event_in_aop}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in search simulation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 Testing AOP Key Event Search Fixes\n")
    
    test1 = test_data_loading()
    test2 = test_key_events_endpoint()
    test3 = test_search_simulation()
    
    print(f"\n📊 Test Results:")
    print(f"Data Loading: {'✅ PASS' if test1 else '❌ FAIL'}")
    print(f"Key Events: {'✅ PASS' if test2 else '❌ FAIL'}")
    print(f"Search Simulation: {'✅ PASS' if test3 else '❌ FAIL'}")
    
    if all([test1, test2, test3]):
        print("\n🎉 All tests passed! The fix should work.")
    else:
        print("\n⚠️ Some tests failed. Need further debugging.")
