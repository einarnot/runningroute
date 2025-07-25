#!/bin/bash

echo "Testing Evaluate Routes API..."
echo "=============================="

curl -X POST http://localhost:3000/api/evaluate-routes \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [
      {
        "id": "route_1",
        "distance": 5.2,
        "ascent": 150,
        "descent": 145,
        "duration": 26,
        "coordinates": [[59.9139, 10.7522], [59.9200, 10.7600], [59.9139, 10.7522]]
      },
      {
        "id": "route_2", 
        "distance": 4.8,
        "ascent": 75,
        "descent": 80,
        "duration": 24,
        "coordinates": [[59.9139, 10.7522], [59.9100, 10.7400], [59.9139, 10.7522]]
      }
    ],
    "preferences": {
      "desiredDistance": 5,
      "pace": 5.0,
      "routeType": "outback",
      "terrain": "flat"
    }
  }' | jq '.'

echo ""
echo "Test completed!"
