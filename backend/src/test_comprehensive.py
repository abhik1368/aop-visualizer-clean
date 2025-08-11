#!/usr/bin/env python3
"""
Comprehensive test for AOP:208 Event:1282 and Key Event Search functionality
This script tests both the complete pathway discovery and the frontend blank screen issue
"""

import requests
import json
import time

def test_backend_endpoints():
    """Test all backend endpoints"""
    print("="*80)
    print("🧪 BACKEND ENDPOINT TESTS")
    print("="*80)
    
    base_url = "http://localhost:5001"
    endpoints = [
        ("/aops", "GET", None, "AOPs list"),
        ("/nodes", "GET", None, "All nodes"),
        ("/key_events", "GET", None, "Key events for dropdown"),
    ]
    
    results = {}
    
    for endpoint, method, data, description in endpoints:
        try:
            print(f"\n🔍 Testing {endpoint} ({description})...")
            
            if method == "GET":
                response = requests.get(f"{base_url}{endpoint}")
            else:
                response = requests.post(f"{base_url}{endpoint}", json=data)
            
            if response.status_code == 200:
                json_data = response.json()
                if endpoint == "/aops":
                    print(f"   ✅ Found {len(json_data)} AOPs")
                    results[endpoint] = f"{len(json_data)} AOPs"
                elif endpoint == "/nodes":
                    print(f"   ✅ Found {len(json_data)} nodes")
                    results[endpoint] = f"{len(json_data)} nodes"
                elif endpoint == "/key_events":
                    key_events = json_data.get('key_events', [])
                    print(f"   ✅ Found {len(key_events)} key events")
                    print(f"   📊 Total available: {json_data.get('total_available', 'unknown')}")
                    if len(key_events) > 0:
                        print(f"   📋 First few: {[ke.get('id') for ke in key_events[:5]]}")
                        # Check for Event:1282
                        event_1282 = next((ke for ke in key_events if ke.get('id') == 'Event:1282'), None)
                        if event_1282:
                            print(f"   🎯 Found Event:1282: {event_1282}")
                        else:
                            print(f"   ⚠️  Event:1282 NOT found in key events")
                    results[endpoint] = f"{len(key_events)} key events"
            else:
                print(f"   ❌ HTTP {response.status_code}: {response.text[:100]}")
                results[endpoint] = f"ERROR {response.status_code}"
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
            results[endpoint] = f"EXCEPTION: {str(e)}"
    
    return results

def test_key_event_search():
    """Test Key Event search with Event:1282"""
    print("\n" + "="*80)
    print("🎯 KEY EVENT SEARCH TEST - Event:1282 (JAK/STAT pathway)")
    print("="*80)
    
    url = "http://localhost:5001/key_event_search"
    test_data = {
        "keyEvents": ["Event:1282"]
    }
    
    try:
        print(f"🔍 Searching for Event:1282...")
        print(f"📤 Request: {test_data}")
        
        response = requests.post(url, json=test_data)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ SUCCESS!")
            print(f"📊 Total nodes found: {len(result.get('nodes', []))}")
            print(f"📊 Total edges found: {len(result.get('edges', []))}")
            print(f"🏢 Affected AOPs: {result.get('affected_aops', [])}")
            print(f"🔗 Shared events: {result.get('shared_events', {})}")
            
            # Analyze nodes by AOP and type
            nodes_by_aop = {}
            nodes_by_type = {}
            
            for node in result.get('nodes', []):
                aop = node.get('aop', 'Unknown')
                node_type = node.get('type', 'Unknown')
                node_id = node.get('id', 'Unknown')
                label = node.get('label', 'No label')
                
                if aop not in nodes_by_aop:
                    nodes_by_aop[aop] = []
                nodes_by_aop[aop].append(f"{node_id} ({node_type}) - {label}")
                
                if node_type not in nodes_by_type:
                    nodes_by_type[node_type] = 0
                nodes_by_type[node_type] += 1
            
            print(f"\n📋 NODES BY AOP:")
            for aop, events in nodes_by_aop.items():
                print(f"   {aop}:")
                for event in events:
                    print(f"     - {event}")
            
            print(f"\n📊 NODES BY TYPE:")
            for node_type, count in nodes_by_type.items():
                print(f"   {node_type}: {count}")
            
            # Check for expected AOP:208 events
            aop_208_events = [node.get('id') for node in result.get('nodes', []) if node.get('aop') == 'Aop:208']
            expected_208_events = ["Event:1282", "Event:1283", "Event:1277"]
            
            print(f"\n🎯 AOP:208 VERIFICATION:")
            print(f"   Expected: {expected_208_events}")
            print(f"   Found: {aop_208_events}")
            
            missing_208 = [e for e in expected_208_events if e not in aop_208_events]
            if missing_208:
                print(f"   ❌ MISSING from AOP:208: {missing_208}")
            else:
                print(f"   ✅ ALL AOP:208 events found!")
            
            # Check for cross-AOP connections (AOP:347 should be included via Event:1283)
            aop_347_events = [node.get('id') for node in result.get('nodes', []) if node.get('aop') == 'Aop:347']
            print(f"\n🔗 CROSS-AOP CONNECTIONS (AOP:347 via Event:1283):")
            print(f"   Found {len(aop_347_events)} events in AOP:347")
            if aop_347_events:
                print(f"   Events: {aop_347_events}")
                
                # Check for MIEs in AOP:347
                aop_347_mies = [node.get('id') for node in result.get('nodes', []) 
                               if node.get('aop') == 'Aop:347' and node.get('type') == 'MolecularInitiatingEvent']
                print(f"   🧬 MIEs in AOP:347: {aop_347_mies}")
            
            # Check edges
            print(f"\n🔗 EDGES ANALYSIS:")
            print(f"   Total edges: {len(result.get('edges', []))}")
            for edge in result.get('edges', [])[:10]:  # Show first 10 edges
                print(f"     {edge.get('source')} → {edge.get('target')} [AOP: {edge.get('aop')}]")
            if len(result.get('edges', [])) > 10:
                print(f"     ... and {len(result.get('edges', [])) - 10} more edges")
            
            return True
            
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_server_availability():
    """Test if server is running and responding"""
    print("="*80)
    print("🌐 SERVER AVAILABILITY TEST")
    print("="*80)
    
    try:
        response = requests.get("http://localhost:5001/aops", timeout=5)
        if response.status_code == 200:
            print("✅ Backend server is running and responding")
            return True
        else:
            print(f"❌ Server responding with error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server on http://localhost:5001")
        print("   👉 Make sure to start the backend server with: python main.py")
        return False
    except requests.exceptions.Timeout:
        print("❌ Server connection timeout")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 COMPREHENSIVE AOP VISUALIZER TEST SUITE")
    print("Testing Event:1282 (JAK/STAT pathway) and frontend blank screen issues")
    print("="*80)
    
    # Test server availability first
    if not test_server_availability():
        print("\n❌ CRITICAL: Backend server is not available. Please start it first.")
        print("   Command: cd backend/src && python main.py")
        return
    
    # Test backend endpoints
    endpoint_results = test_backend_endpoints()
    
    # Test Key Event search
    search_success = test_key_event_search()
    
    # Summary
    print("\n" + "="*80)
    print("📋 TEST SUMMARY")
    print("="*80)
    
    print("\n🌐 Backend Endpoints:")
    for endpoint, result in endpoint_results.items():
        status = "✅" if "ERROR" not in result and "EXCEPTION" not in result else "❌"
        print(f"   {status} {endpoint}: {result}")
    
    print(f"\n🎯 Key Event Search:")
    print(f"   {'✅' if search_success else '❌'} Event:1282 search: {'SUCCESS' if search_success else 'FAILED'}")
    
    print(f"\n🔧 TROUBLESHOOTING TIPS:")
    if not search_success:
        print("   - Check backend server logs for errors")
        print("   - Verify TSV data files are loaded correctly")
        print("   - Ensure CORS is working (backend has flask-cors enabled)")
    
    print("   - For frontend blank screen:")
    print("     1. Open browser developer tools (F12)")
    print("     2. Check Console tab for JavaScript errors")
    print("     3. Check Network tab for failed API calls")
    print("     4. Ensure frontend is connecting to http://localhost:5001")
    
    print(f"\n📊 EXPECTED RESULTS for Event:1282:")
    print("   - Should find 3 events in AOP:208: Event:1282 → Event:1283 → Event:1277")
    print("   - Should find connected events in AOP:347 via Event:1283")
    print("   - Should include MIEs from AOP:347: Event:1792, Event:1270")
    print("   - Total nodes should be > 5 (complete pathways)")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    main()
