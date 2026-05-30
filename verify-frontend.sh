#!/bin/bash

# Frontend RBAC & Human Takeover System Verification
# This script verifies that the frontend builds correctly and has all required components

set -e

cd "$(dirname "$0")" || exit 1

if [ ! -d "frontend" ]; then
  echo "❌ Frontend directory not found"
  exit 1
fi

cd frontend

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Frontend RBAC System Verification & Build Check      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check required files exist
echo "🔍 Checking required files..."

files=(
  "components/Sidebar.jsx"
  "components/ChatWindow.jsx"
  "app/dashboard/layout.jsx"
  "app/dashboard/inbox/page.jsx"
  "app/dashboard/team/page.jsx"
  "lib/store.js"
  "lib/api.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file NOT FOUND"
    exit 1
  fi
done

echo ""
echo "✓ All required files exist"
echo ""

# Check for required code patterns
echo "🔍 Verifying implementation patterns..."

# Check Sidebar.jsx for agent role filtering
if grep -q "user?.role === 'agent'" components/Sidebar.jsx; then
  echo "  ✓ Sidebar filters navigation by agent role"
else
  echo "  ✗ Sidebar missing agent role filter"
  exit 1
fi

# Check layout.jsx for route restriction
if grep -q "user?.role === 'agent'" app/dashboard/layout.jsx; then
  echo "  ✓ Layout enforces agent route restrictions"
else
  echo "  ✗ Layout missing agent route restriction"
  exit 1
fi

# Check ChatWindow.jsx for takeover UI
if grep -q "showTakeoverBanner\|isLocked" components/ChatWindow.jsx; then
  echo "  ✓ ChatWindow displays takeover state"
else
  echo "  ✗ ChatWindow missing takeover UI"
  exit 1
fi

# Check ChatWindow.jsx for Take Over button
if grep -q "Take Over\|handleAssign" components/ChatWindow.jsx; then
  echo "  ✓ ChatWindow has Take Over action"
else
  echo "  ✗ ChatWindow missing Take Over button"
  exit 1
fi

# Check inbox page for filter tabs
if grep -q "My Assigned\|Unassigned Queue" app/dashboard/inbox/page.jsx; then
  echo "  ✓ Inbox has agent filter tabs"
else
  echo "  ✗ Inbox missing filter tabs"
  exit 1
fi

# Check inbox for socket listener
if grep -q "conversation_assigned" app/dashboard/inbox/page.jsx; then
  echo "  ✓ Inbox listens for conversation_assigned events"
else
  echo "  ✗ Inbox missing socket listener"
  exit 1
fi

# Check team page for suspension toggle
if grep -q "handleToggleSuspend\|isSuspended" app/dashboard/team/page.jsx; then
  echo "  ✓ Team page has suspension toggle"
else
  echo "  ✗ Team page missing suspension toggle"
  exit 1
fi

# Check team page for monitoring tab
if grep -q "Monitoring.*Performance\|monitoringData" app/dashboard/team/page.jsx; then
  echo "  ✓ Team page has monitoring tab"
else
  echo "  ✗ Team page missing monitoring tab"
  exit 1
fi

echo ""
echo "✓ All implementation patterns verified"
echo ""

# Build Next.js
echo "🔨 Building Next.js frontend..."
echo ""

if npm run build 2>&1 | tee /tmp/build.log; then
  echo ""
  echo "✓ Build successful!"
  echo ""
  
  # Check for build warnings
  if grep -qi "error" /tmp/build.log; then
    echo "⚠️  Build completed with errors - review above"
    exit 1
  fi
  
  if grep -qi "warning" /tmp/build.log; then
    echo "⚠️  Build completed with warnings - consider reviewing"
  fi
else
  echo ""
  echo "❌ Build failed!"
  echo ""
  exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              VERIFICATION COMPLETE ✓                   ║"
echo "║                                                        ║"
echo "║  Frontend RBAC system verified and built successfully  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
