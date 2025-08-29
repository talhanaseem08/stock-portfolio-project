#!/usr/bin/env python3
import requests
import json

def test_backend():
    base_url = "http://127.0.0.1:5000"
    
    try:
        # Test home endpoint
        response = requests.get(f"{base_url}/")
        print(f"Home endpoint: {response.status_code} - {response.json()}")
        
        # Test meta KPIs endpoint (this will fail without data, but should return 404, not connection error)
        response = requests.get(f"{base_url}/analyze-meta/test-token/kpis")
        print(f"Meta KPIs endpoint: {response.status_code} - {response.json()}")
        
        print("Backend is running and responding!")
        
    except requests.exceptions.ConnectionError:
        print("Backend is not responding - connection refused")
    except Exception as e:
        print(f"Error testing backend: {e}")

if __name__ == "__main__":
    test_backend()
