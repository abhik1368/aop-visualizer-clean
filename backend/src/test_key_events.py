#!/usr/bin/env python3
"""
Test script for Key Event pathway search logic
"""
import json
import requests

def test_key_event_search():
    """Test the enhanced Key Event search with Event:1756 and Event:1835"""
    
    # Test with Event:1756 which appears in multiple AOPs
    # Should include Event:1796 (MIE) in AOP:349
    test_payload = {
        "keyEvents": ["Event:1756"]
    }
    
    print("🧪 Testing with Event:1756 (shared across AOPs)...")
    
    try:
        response = requests.post(
            'http://localhost:5001/key_event_search',
            json=test_payload,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Key Event Search Successful!")
            print(f"📊 Found {result.get('count', 0)} nodes and {result.get('edge_count', 0)} edges")
            print(f"🔄 Affected AOPs: {result.get('affected_aops', [])}")
            print(f"🔗 Shared events: {result.get('shared_events', {})}")
            
            # Check for specific nodes we expect
            nodes = result.get('nodes', [])
            node_ids = [node.get('id') for node in nodes]
            
            print(f"\n� Checking for expected nodes:")
            
            # Check for Event:1796 (MIE in AOP:349)
            if "Event:1796" in node_ids:
                print("✅ Event:1796 (MIE: 11β-hydroxylase inhibition) - FOUND")
                event_1796 = next(n for n in nodes if n.get('id') == "Event:1796")
                print(f"   Type: {event_1796.get('type')}, AOP: {event_1796.get('aop')}")
            else:
                print("❌ Event:1796 (MIE: 11β-hydroxylase inhibition) - MISSING")
            
            # Check for Event:1835 (parent of Event:1756)
            if "Event:1835" in node_ids:
                print("✅ Event:1835 (Cortisol and 11β-(OH) testosterone decreased) - FOUND")
            else:
                print("❌ Event:1835 (parent event) - MISSING")
                
            # Check for Event:1836 (child of Event:1835)
            if "Event:1836" in node_ids:
                print("✅ Event:1836 (Decreased plasma Cortisol level) - FOUND")
            else:
                print("❌ Event:1836 (child event) - MISSING")
            
            # Show nodes by type
            print(f"\n📝 Nodes by type:")
            node_types = {}
            for node in nodes:
                node_type = node.get('type', 'Unknown')
                if node_type not in node_types:
                    node_types[node_type] = []
                node_types[node_type].append(node.get('id'))
            
            for node_type, ids in node_types.items():
                print(f"  {node_type}: {len(ids)} nodes")
                for node_id in ids[:3]:  # Show first 3
                    node = next(n for n in nodes if n.get('id') == node_id)
                    print(f"    - {node_id}: {node.get('label', 'No label')} (AOP: {node.get('aop')})")
                if len(ids) > 3:
                    print(f"    ... and {len(ids) - 3} more")
                    
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Backend server not running. Start with: python main.py")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_event_1835():
    """Test with Event:1835 which should include its children"""
    
    test_payload = {
        "keyEvents": ["Event:1835"]
    }
    
    print("\n🧪 Testing with Event:1835 (Cortisol and 11β-(OH) testosterone decreased)...")
    
    try:
        response = requests.post(
            'http://localhost:5001/key_event_search',
            json=test_payload,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Event:1835 Search Successful!")
            print(f"📊 Found {result.get('count', 0)} nodes and {result.get('edge_count', 0)} edges")
            
            nodes = result.get('nodes', [])
            node_ids = [node.get('id') for node in nodes]
            
            print(f"\n🔍 Expected child events of Event:1835:")
            if "Event:1756" in node_ids:
                print("✅ Event:1756 (Decreased plasma 11-ketotestosterone level) - FOUND")
            else:
                print("❌ Event:1756 - MISSING")
                
            if "Event:1836" in node_ids:
                print("✅ Event:1836 (Decreased plasma Cortisol level) - FOUND") 
            else:
                print("❌ Event:1836 - MISSING")
                
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing Enhanced Key Event Search...")
    test_key_event_search()
    test_event_1835()
