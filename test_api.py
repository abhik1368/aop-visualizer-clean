import requests
import json

def test_key_events_api():
    """Test the key events API"""
    print("Testing key events API...")
    
    try:
        response = requests.get("http://localhost:5001/key_events")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Key events API working - {len(data)} events found")
            
            # Check for specific events
            event_1282_found = any(event["id"] == "Event:1282" for event in data)
            event_1715_found = any(event["id"] == "Event:1715" for event in data)
            
            print(f"Event:1282 found: {event_1282_found}")
            print(f"Event:1715 found: {event_1715_found}")
            
            # Show first 5 events
            print("\nFirst 5 key events:")
            for i, event in enumerate(data[:5]):
                print(f"  {i+1}. {event['id']}: {event['label']}")
            
            return True, data
        else:
            print(f"Key events API failed: {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f" Error testing key events API: {e}")
        return False, None

def test_key_event_search():
    """Test the key event search API"""
    print("\nTesting key event search API...")
    
    try:
        # Test with Event:1715
        payload = {"events": ["Event:1715"]}
        
        response = requests.post(
            "http://localhost:5001/key_event_search",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f" Key event search successful!")
            print(f"Found {data.get('count', 0)} nodes and {data.get('edge_count', 0)} edges")
            print(f"Affected AOPs: {data.get('affected_aops', [])}")
            print(f"Shared events: {data.get('shared_events', {})}")
            return True
        else:
            print(f"Key event search failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f" Error testing key event search: {e}")
        return False

if __name__ == "__main__":
    print(" Testing Key Event APIs\n")
    
    # Test key events endpoint
    test1_result, key_events = test_key_events_api()
    
    # Test key event search
    test2_result = test_key_event_search()
    
    print(f"\n Test Results:")
    print(f"Key Events API: {' PASS' if test1_result else ' FAIL'}")
    print(f"Key Event Search: {' PASS' if test2_result else ' FAIL'}")
    
    if test1_result and test2_result:
        print("\n All API tests passed!")
    else:
        print("\n Some API tests failed.")
