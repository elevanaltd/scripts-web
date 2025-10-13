#!/bin/bash

# Test webhook endpoint with eav_code array format
echo "Testing SmartSuite webhook with eav_code array..."

# Test project update
echo "1. Testing project webhook..."
curl -X POST http://localhost:3000/api/webhook-smartsuite \
  -H "Content-Type: application/json" \
  -H "x-smartsuite-signature: test-secret" \
  -d '{
    "table": "projects",
    "event_type": "record.updated",
    "record": {
      "id": "68aad840f996b29133662fcd",
      "title": "Test Project with EAV",
      "eav_code": "EAV-2024-001",
      "client_filter": "Test Client",
      "due_date": "2024-12-31",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }'
echo ""
echo ""

# Test video update with eav_code as array (lookup field)
echo "2. Testing video webhook with eav_code array..."
curl -X POST http://localhost:3000/api/webhook-smartsuite \
  -H "Content-Type: application/json" \
  -H "x-smartsuite-signature: test-secret" \
  -d '{
    "table": "videos",
    "event_type": "record.updated",
    "record": {
      "id": "video123",
      "title": "Test Video",
      "eav_code": ["EAV-2024-001"],
      "production_type": "Standard",
      "main_stream_status": "ready",
      "vo_stream_status": "pending",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }'
echo ""
echo ""

# Test video with multiple eav_codes in array (should take first)
echo "3. Testing video webhook with multiple eav_codes in array..."
curl -X POST http://localhost:3000/api/webhook-smartsuite \
  -H "Content-Type: application/json" \
  -H "x-smartsuite-signature: test-secret" \
  -d '{
    "table": "videos",
    "event_type": "record.updated",
    "record": {
      "id": "video456",
      "title": "Another Test Video",
      "eav_code": ["EAV-2024-001", "EAV-2024-002"],
      "production_type": "Premium",
      "main_stream_status": "processing",
      "vo_stream_status": "processing",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }'
echo ""
echo "Test complete!"