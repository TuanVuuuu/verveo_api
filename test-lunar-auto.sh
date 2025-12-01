#!/bin/bash

# Auto test Lunar Calendar API - Create user, get token, and test
# Usage: ./test-lunar-auto.sh

BASE_URL="http://localhost:8000"
EMAIL="test@example.com"
PASSWORD="test123456"

echo "🧪 Auto Testing Lunar Calendar API"
echo "=================================="
echo ""

# Step 1: Create test user
echo "Step 1: Creating test user..."
npm run create-test-user
echo ""

# Step 2: Get JWT token
echo "Step 2: Getting JWT token..."
TOKEN=$(./get-test-token.sh 2>/dev/null | grep -A 1 "JWT Token:" | tail -1 | tr -d '"' | xargs)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get token. Trying manual method..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    if command -v jq &> /dev/null; then
        TOKEN=$(echo "$RESPONSE" | jq -r '.data.token // empty')
    fi
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Error: Failed to get JWT token"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "✅ Token retrieved: ${TOKEN:0:20}..."
echo ""

# Step 3: Test with prompt "ngày mùng 1 âm lịch tôi sẽ về quê"
echo "Step 3: Testing with prompt 'ngày mùng 1 âm lịch tôi sẽ về quê'"
echo "Expected: start_time should be around 2025-11-20 (mùng 1 tháng 10 âm)"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ngày mùng 1 âm lịch tôi sẽ về quê"
  }')

if command -v jq &> /dev/null; then
    echo "Response:"
    echo "$RESPONSE" | jq '.'
    echo ""
    echo "Start time:"
    START_TIME=$(echo "$RESPONSE" | jq -r '.start_time // "N/A"')
    echo "$START_TIME"
    echo ""
    
    if [[ "$START_TIME" == *"2025-11-20"* ]]; then
        echo "✅ SUCCESS: Start time is correct (2025-11-20)"
    else
        echo "⚠️  WARNING: Start time might be incorrect"
        echo "Expected: 2025-11-20 (mùng 1 tháng 10 âm)"
        echo "Got: $START_TIME"
    fi
else
    echo "$RESPONSE"
fi

echo ""
echo "---"
echo ""

# Step 4: Test with prompt "ngày 28 Tết nguyên đán tôi sẽ về quê"
echo "Step 4: Testing with prompt 'ngày 28 Tết nguyên đán tôi sẽ về quê'"
echo "Expected: start_time should be around 2026-02-15 (ngày 28 tháng 12 âm lịch)"
echo ""

RESPONSE2=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ngày 28 Tết nguyên đán tôi sẽ về quê"
  }')

if command -v jq &> /dev/null; then
    echo "Response:"
    echo "$RESPONSE2" | jq '.'
    echo ""
    echo "Start time:"
    START_TIME2=$(echo "$RESPONSE2" | jq -r '.start_time // "N/A"')
    echo "$START_TIME2"
    echo ""
    
    if [[ "$START_TIME2" == *"2026-02-15"* ]]; then
        echo "✅ SUCCESS: Start time is correct (2026-02-15)"
    else
        echo "⚠️  WARNING: Start time might be incorrect"
        echo "Expected: 2026-02-15 (ngày 28 tháng 12 âm lịch)"
        echo "Got: $START_TIME2"
    fi
else
    echo "$RESPONSE2"
fi

echo ""
echo "✅ Testing completed!"
echo ""
echo "Check server logs for systemPrompt and userPrompt to verify AI receives correct information."

