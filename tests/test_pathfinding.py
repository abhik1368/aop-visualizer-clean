import requests
import json

# Test the new MIE to AO pathfinding endpoint
def test_mie_to_ao_paths():
    url = "http://localhost:5001/mie_to_ao_paths"
    params = {
        "aop": "Aop:1",
        "k": 3,
        "type": "shortest",
        "hypergraph": "true",
        "max_per_hypernode": 4
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            print("✅ MIE to AO Pathfinding Test Successful!")
            print(f"Found {len(data.get('paths', []))} paths")
            print(f"MIE nodes: {data.get('mie_nodes', [])}")
            print(f"AO nodes: {data.get('ao_nodes', [])}")
            
            if data.get('paths'):
                print("\nSample paths:")
                for i, path in enumerate(data['paths'][:2]):
                    print(f"Path {i+1}: {' -> '.join(path['path'])}")
                    print(f"Length: {path['length']}")
            
            if data.get('hypergraph_data'):
                print(f"\n✅ Hypergraph data available with {len(data['hypergraph_data'].get('nodes', []))} hypernodes")
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("Testing MIE to AO Pathfinding...")
    test_mie_to_ao_paths()
