#!/bin/bash

# SAS4 Client Area MCP Server - API Endpoints Examples
# Base URL (adjust if running on different host/port)
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "SAS4 Client Area MCP Server - API Examples"
echo "=========================================="
echo ""

# ==========================================
# 1. Health Check
# ==========================================
echo "1. Health Check"
echo "GET $BASE_URL/health"
echo ""
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo "----------------------------------------"
echo ""

# ==========================================
# 2. Search License
# ==========================================
echo "2. Search License by Keyword"
echo "POST $BASE_URL/api/search-license"
echo "Search can be done by: license ID, email, or EHWID (Hardware ID)"
echo ""

# Example 1: Search by EHWID
echo "Example 1: Search by EHWID"
curl -X POST "$BASE_URL/api/search-license" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Q46I5-BEAAO-RQA4R-EBQDT"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo ""

# Example 2: Search by Email
echo "Example 2: Search by Email"
curl -X POST "$BASE_URL/api/search-license" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "9333905@gmail.com"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo ""

# Example 3: Search by License ID
echo "Example 3: Search by License ID"
curl -X POST "$BASE_URL/api/search-license" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "12"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo "----------------------------------------"
echo ""

# ==========================================
# 3. Create Invoice
# ==========================================
echo "3. Create Invoice"
echo "POST $BASE_URL/api/create-invoice"
echo ""

# Example 1: Create invoice with all fields
echo "Example 1: Create invoice with all fields"
curl -X POST "$BASE_URL/api/create-invoice" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "9333905@gmail.com",
    "description": "this is Description",
    "comments": "this is Comment",
    "license_id": "8888",
    "due_on": "2030-10-10 10:10:10",
    "invoice_item": "invoice item",
    "price": 10
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo ""

# Example 2: Create invoice with minimal required fields
echo "Example 2: Create invoice with minimal required fields"
curl -X POST "$BASE_URL/api/create-invoice" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "9333905@gmail.com",
    "invoice_item": "Monthly subscription",
    "price": 25.50
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo ""

# Example 3: Create invoice with JSON items array
echo "Example 3: Create invoice with JSON items array"
curl -X POST "$BASE_URL/api/create-invoice" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "9333905@gmail.com",
    "description": "Service invoice",
    "invoice_item": "[{\"text\":\"invoice item\",\"qty\":1,\"price\":\"$10.00\"}]",
    "price": 10
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo "----------------------------------------"
echo ""

# ==========================================
# 4. Swap Licenses
# ==========================================
echo "4. Swap Licenses"
echo "POST $BASE_URL/api/swap-licenses"
echo ""

# Example: Swap between two licenses
echo "Example: Swap licenses between two EHWIDs"
curl -X POST "$BASE_URL/api/swap-licenses" \
  -H "Content-Type: application/json" \
  -d '{
    "old_ehwid": "Q46I5-BEAAO-RQA4R-EBQDT",
    "new_ehwid": "XXXXX-XXXXX-XXXXX-XXXXX"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""
echo "----------------------------------------"
echo ""

echo "=========================================="
echo "All API examples completed!"
echo "=========================================="

