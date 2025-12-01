#!/bin/bash

# Test Lunar Calendar API locally
# Usage: ./test-lunar-local.sh [JWT_TOKEN]

BASE_URL="http://localhost:8000"
JWT_TOKEN="${1:-${JWT_TOKEN}}"

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ Error: JWT_TOKEN is required"
    echo ""
    echo "Usage: ./test-lunar-local.sh YOUR_JWT_TOKEN"
    echo "Or set: export JWT_TOKEN=your_token"
    echo ""
    echo "To get JWT token, login first:"
    echo "curl -X POST $BASE_URL/auth/login \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"email\":\"your_email\",\"password\":\"your_password\"}'"
    exit 1
fi

echo "🧪 Testing Lunar Calendar API"
echo "=================================="
echo ""
echo "Test 1: ngày mùng 1 âm lịch tôi sẽ về quê"
echo "Expected: Should return date around 20/11/2025 (mùng 1 tháng 10 âm)"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ngày mùng 1 âm lịch tôi sẽ về quê"
  }')

echo "Response:"
if command -v jq &> /dev/null; then
    echo "$RESPONSE" | jq '.'
    echo ""
    echo "Start time:"
    echo "$RESPONSE" | jq -r '.start_time // "N/A"'
    echo ""
    echo "Expected: 2025-11-20 (mùng 1 tháng 10 âm)"
else
    echo "$RESPONSE"
fi

echo ""
echo "---"
echo ""

echo "Test 2: ngày 28 Tết nguyên đán tôi sẽ về quê"
echo "Expected: Should return date around 15/2/2026 (ngày 28 tháng 12 âm lịch)"
echo ""

RESPONSE2=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ngày 28 Tết nguyên đán tôi sẽ về quê"
  }')

echo "Response:"
if command -v jq &> /dev/null; then
    echo "$RESPONSE2" | jq '.'
    echo ""
    echo "Start time:"
    echo "$RESPONSE2" | jq -r '.start_time // "N/A"'
    echo ""
    echo "Expected: 2026-02-15 (ngày 28 tháng 12 âm lịch)"
else
    echo "$RESPONSE2"
fi

echo ""
echo "✅ Testing completed!"
echo ""
echo "Check server logs for systemPrompt and userPrompt to verify AI receives correct information."

