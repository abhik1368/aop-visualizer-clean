#!/usr/bin/env python3
"""
Simple test script to check if the backend is working and test the Perplexity API
"""
import sys
import os
import requests
import json

def test_backend():
    """Test if the backend is responding"""
    try:
        # Test the root endpoint
        response = requests.get("http://localhost:5001/")
        print(f"Root endpoint status: {response.status_code}")
        print(f"Root endpoint response: {response.text}")
        return True
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to backend at localhost:5001")
        print("Make sure the backend server is running")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def test_perplexity_endpoint():
    """Test the Perplexity analysis endpoint"""
    try:
        payload = {
            "query": "What are the effects of oxidative stress?",
            "node_ids": ["test_node"],
            "context_type": "general"
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            "http://localhost:5001/perplexity_analysis",
            json=payload,
            headers=headers
        )
        
        print(f"Perplexity endpoint status: {response.status_code}")
        print(f"Perplexity endpoint response: {response.text}")
        return True
        
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to backend at localhost:5001")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    print("Testing AOP Network Visualizer Backend...")
    print("=" * 50)
    
    # Test basic connectivity
    if test_backend():
        print("\n" + "=" * 50)
        # Test Perplexity endpoint
        test_perplexity_endpoint()
    
    print("\nTest completed.")

if __name__ == "__main__":
    main()
