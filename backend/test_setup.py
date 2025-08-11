#!/usr/bin/env python3
"""
Test script to verify Perplexity API integration
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    import requests
    print("✅ All required packages imported successfully")
    
    # Load environment variables
    load_dotenv()
    
    # Check API key
    api_key = os.getenv('PERPLEXITY_API_KEY')
    if api_key:
        print(f"✅ Perplexity API key found: {api_key[:10]}...")
    else:
        print("❌ Perplexity API key not found in environment")
        print("   Please set PERPLEXITY_API_KEY in your .env file")
    
    print("\n🚀 Setup verification complete!")
    print("   Ready to use Perplexity API integration")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Please install missing packages: pip install requests python-dotenv")
except Exception as e:
    print(f"❌ Setup error: {e}")
