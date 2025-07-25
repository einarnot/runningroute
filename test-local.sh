#!/bin/bash

echo "Starting local Vercel development server..."
echo "=========================================="

# Start vercel dev in background
nohup vercel dev --listen 3000 > vercel-dev.log 2>&1 &
VERCEL_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 8

echo "Testing local API endpoints..."
echo "=============================="

# Test generate-routes
echo "1. Testing generate-routes endpoint:"
curl -X POST http://localhost:3000/api/generate-routes \
  -H "Content-Type: application/json" \
  -d '{"coordinates": [[10.7522, 59.9139], [10.7622, 59.9239], [10.7522, 59.9139]]}' \
  -w "\nStatus: %{http_code}\n\n"

echo "2. Testing evaluate-routes endpoint:"
curl -X POST http://localhost:3000/api/evaluate-routes \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [{"summary": {"distance": 5000, "duration": 1800}}],
    "preferences": {"distance": 5000, "terrain": "flat"}
  }' \
  -w "\nStatus: %{http_code}\n\n"

echo "Stopping server..."
kill $VERCEL_PID
wait $VERCEL_PID 2>/dev/null

echo "Local testing complete. Check the output above."
echo "If you see JSON responses, the API is working locally."