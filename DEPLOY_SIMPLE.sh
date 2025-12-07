#!/bin/bash

# Simple deployment script that actually works!

echo "🚀 Deploying LocalWeb Scout Business Platform"
echo ""

# Add all files
git add -A

# Show what's being added
echo "📝 Files to commit:"
git status --short

echo ""
read -p "Press Enter to continue with deployment..."

# Commit
git commit -m "Add LocalWeb Scout - Complete Business Platform

- Lead management CRM (localweb/)
- Professional services page (localweb/services.html)
- Complete pricing packages ($799, $1,499, $2,999+)
- 6 add-on services
- 3 maintenance plans
- Portfolio showcase
- Sales process and documentation"

# Push
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "Visit in 2-3 minutes:"
echo "  • https://davedirty.com/localweb"
echo "  • https://davedirty.com/localweb/services.html"
echo ""
