#!/usr/bin/env python3
"""
Simple test to check if backend server is responding properly
"""

import requests
import json

def test_server():
    """Test basic server endpoints"""
    base_url = "http://localhost:5001"
    
    endpoints = [
        "/aops",
        "/key_events", 
        "/nodes"
    ]
    
    for endpoint in endpoints:
        try:
            print(f"\n🧪 Testing {endpoint}...")
            response = requests.get(f"{base_url}{endpoint}")
            
            if response.status_code == 200:
                data = response.json()
                if endpoint == "/aops":
                    print(f"✅ AOPs: {len(data)} found")
                elif endpoint == "/key_events":
                    key_events = data.get('key_events', [])
                    print(f"✅ Key Events: {len(key_events)} found")
                    if len(key_events) > 0:
                        print(f"   First few: {[ke.get('id') for ke in key_events[:3]]}")
                        # Check for Event:1282 specifically
                        event_1282 = next((ke for ke in key_events if ke.get('id') == 'Event:1282'), None)
                        if event_1282:
                            print(f"   ✅ Found Event:1282: {event_1282}")
                        else:
                            print(f"   ❌ Event:1282 NOT found")
                elif endpoint == "/nodes":
                    print(f"✅ Nodes: {len(data)} found")
            else:
                print(f"❌ HTTP {response.status_code}: {response.text[:100]}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("="*50)
    print("Testing Backend Server Endpoints")
    print("="*50)
    test_server()
    print("\n" + "="*50)
