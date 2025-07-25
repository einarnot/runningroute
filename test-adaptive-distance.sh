#!/bin/bash

echo "Testing Adaptive Distance Adjustment in Generate Routes API..."
echo "============================================================="

curl -X POST http://localhost:3000/api/generate-routes \
  -H "Content-Type: application/json" \
  -d '{
    "distance": 5,
    "pace": 5.0,
    "routeType": "outback", 
    "terrain": "flat",
    "startLat": 59.9139,
    "startLon": 10.7522,
    "alternatives": 5
  }' | jq '
    .routes[] | {
      id: .id,
      bearing: .bearing,
      target_distance: .targetDistance,
      actual_distance: .distance,
      distance_accuracy: .distanceAccuracy,
      accuracy_percentage: ((.distanceAccuracy | tonumber) * 100 | floor)
    }
  '

echo ""
echo "Key metrics to watch:"
echo "- target_distance: What we asked for"
echo "- actual_distance: What OpenRouteService returned"
echo "- distance_accuracy: How close we got (lower is better)"
echo "- Routes later in the sequence should have better accuracy"
echo ""
echo "Test completed!"
