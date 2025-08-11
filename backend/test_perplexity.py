import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

PERPLEXITY_API_KEY = os.getenv('PERPLEXITY_API_KEY')
PERPLEXITY_BASE_URL = "https://api.perplexity.ai/chat/completions"

def test_perplexity_api():
    """Test the Perplexity API with the correct format"""
    
    if not PERPLEXITY_API_KEY:
        print("❌ No API key found")
        return
    
    print(f"✅ API Key found: {PERPLEXITY_API_KEY[:10]}...")
    
    # Test payload matching your example
    payload = {
        "model": "sonar",
        "messages": [
            {"role": "user", "content": "What is the latest news in AI research?"}
        ]
    }
    
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    print("🚀 Testing Perplexity API...")
    
    try:
        response = requests.post(PERPLEXITY_BASE_URL, json=payload, headers=headers)
        
        print(f"📡 Response Status: {response.status_code}")
        print(f"📄 Raw Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ API Test Successful!")
            print(f"� Full Response Structure: {result}")
            print(f"�📝 Response: {result['choices'][0]['message']['content'][:100]}...")
            
            # Check for citations
            if 'citations' in result:
                print(f"📚 Citations found: {len(result['citations'])}")
            else:
                print("📚 No citations in response")
                
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_perplexity_api()
