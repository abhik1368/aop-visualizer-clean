#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("Testing Perplexity integration...")

try:
    # Test imports
    import requests
    from dotenv import load_dotenv
    print("Imports successful")
    
    # Load environment
    load_dotenv()
    api_key = os.getenv('PERPLEXITY_API_KEY')
    print(f" API Key loaded: {api_key[:10] if api_key else 'None'}...")
    
    # Test a minimal request
    if api_key:
        url = "https://api.perplexity.ai/chat/completions"
        
        payload = {
            "model": "sonar",
            "messages": [
                {"role": "user", "content": "Hello, can you analyze toxicology?"}
            ]
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        print("Making API request...")
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f" Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("Success!")
            print(f"Response keys: {list(result.keys())}")
            
            if 'choices' in result:
                content = result['choices'][0]['message']['content']
                print(f"Content preview: {content[:100]}...")
            
            print(" Perplexity integration working!")
            
        else:
            print(f" Error {response.status_code}: {response.text}")
    
except Exception as e:
    print(f" Test failed: {e}")
    import traceback
    traceback.print_exc()

print("\nTest complete.")
