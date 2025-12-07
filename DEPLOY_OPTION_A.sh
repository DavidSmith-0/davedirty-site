#!/bin/bash

echo "🚀 OPTION A - Deploying Discussion Board + Updated Homepage"
echo ""

cd "/Users/dave/Downloads/cloud guestboard"

echo "📋 What's Being Deployed:"
echo "  ✓ Discussion board (3 files)"
echo "  ✓ Updated homepage email (david.smith.32@hotmail.com)"
echo ""

# Check files exist
if [ ! -f "discussion/index.html" ]; then
    echo "❌ Error: discussion/index.html not found!"
    exit 1
fi

if [ ! -f "discussion/discussion.css" ]; then
    echo "❌ Error: discussion/discussion.css not found!"
    exit 1
fi

if [ ! -f "discussion/discussion.js" ]; then
    echo "❌ Error: discussion/discussion.js not found!"
    exit 1
fi

echo "✅ All files present"
echo ""

# Show what changed
echo "📝 Changes:"
echo "  • index.html: Email changed to david.smith.32@hotmail.com"
echo "  • discussion/index.html: NEW - Discussion board page"
echo "  • discussion/discussion.css: NEW - Discussion board styles"
echo "  • discussion/discussion.js: NEW - Discussion board functionality"
echo ""

# Git operations
echo "📤 Committing to git..."
git add index.html discussion/

git commit -m "Option A deployment: Add discussion board and update email

- Created discussion board with clean, professional design
- Updated contact email to david.smith.32@hotmail.com
- Discussion board ready for AWS integration
- All files follow established design system"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "⏳ Wait 2-3 minutes for GitHub Pages to update, then visit:"
echo ""
echo "  🏠 Homepage: https://davedirty.com/"
echo "     (Email now: david.smith.32@hotmail.com)"
echo ""
echo "  💬 Discussion: https://davedirty.com/discussion"
echo "     (Working with demo data, ready for AWS)"
echo ""
echo "  📝 Dave Notes: https://davedirty.com/davenotes"
echo "     (Still working with cloud sync!)"
echo ""
echo "🎉 Option A Complete!"
echo ""
echo "Next Steps:"
echo "  1. Test discussion board (works locally with demo data)"
echo "  2. Connect AWS API for discussion board persistence"
echo "  3. (Optional) Build LocalWeb Scout (Option B) later"
echo ""
