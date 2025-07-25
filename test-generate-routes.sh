#!/bin/bash

echo "Testing Generate Routes API..."
echo "================================"

curl -X POST http://localhost:3000/api/generate-routes \
  -H "Content-Type: application/json" \
  -d '{
    "distance": 5,
    "pace": 5.5,
    "routeType": "outback",
    "terrain": "flat",
    "startLat": 59.9139,
    "startLon": 10.7522
  }' | jq '.'

echo ""
echo "Test completed!"
