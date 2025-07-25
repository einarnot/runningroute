#!/bin/bash

# Test script for Vercel API endpoints
API_BASE="https://v5-ks9p87l86-einar-notlands-projects.vercel.app/api"

echo "Testing OpenRouteService proxy endpoint..."
echo "=========================================="

# Test generate-routes endpoint with Oslo coordinates
curl -X POST "${API_BASE}/generate-routes" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [
      [10.7522, 59.9139],
      [10.7622, 59.9239], 
      [10.7522, 59.9139]
    ]
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo -e "\n\nTesting AI route evaluation endpoint..."
echo "======================================="

# Test evaluate-routes endpoint with sample data
curl -X POST "${API_BASE}/evaluate-routes" \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [
      {
        "summary": {
          "distance": 5000,
          "duration": 1800,
          "ascent": 50,
          "descent": 50
        }
      },
      {
        "summary": {
          "distance": 5200,
          "duration": 1900,
          "ascent": 120,
          "descent": 120
        }
      }
    ],
    "preferences": {
      "distance": 5000,
      "terrain": "flat",
      "routeType": "loop"
    }
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"