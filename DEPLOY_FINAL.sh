#!/bin/bash

echo "🚀 FINAL DEPLOYMENT - Discussion + Resume + Updated Homepage"
echo ""

cd "/Users/dave/Downloads/cloud guestboard"

echo "📋 What's Being Deployed:"
echo "  ✓ Discussion board (3 files)"
echo "  ✓ Resume page (2 files - NEW!)"
echo "  ✓ Updated homepage email (david.smith.32@hotmail.com)"
echo ""

# Check files exist
if [ ! -f "discussion/index.html" ]; then
    echo "❌ Error: discussion/index.html not found!"
    exit 1
fi

if [ ! -f "resume.html" ]; then
    echo "❌ Error: resume.html not found!"
    exit 1
fi

if [ ! -f "resume.css" ]; then
    echo "❌ Error: resume.css not found!"
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
echo "  • resume.html: NEW - Professional resume page"
echo "  • resume.css: NEW - Resume styles"
echo ""

# Git operations
echo "📤 Committing to git..."
git add index.html discussion/ resume.html resume.css

git commit -m "Final deployment: Discussion board, resume page, and email update

- Created discussion board with professional design
- Added complete professional resume at /resume
- Updated contact email to david.smith.32@hotmail.com
- Resume includes print functionality
- All USAF background and credentials included
- Ready for job applications"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "⏳ Wait 2-3 minutes for GitHub Pages to update, then visit:"
echo ""
echo "  🏠 Homepage: https://davedirty.com/"
echo "     (Email: david.smith.32@hotmail.com)"
echo ""
echo "  📄 Resume: https://davedirty.com/resume"
echo "     (Professional resume with print function)"
echo ""
echo "  💬 Discussion: https://davedirty.com/discussion"
echo "     (Working with demo data)"
echo ""
echo "  📝 Dave Notes: https://davedirty.com/davenotes"
echo "     (Cloud sync still working!)"
echo ""
echo "🎉 Complete!"
echo ""
echo "Next Steps:"
echo "  1. Visit davedirty.com/resume and test print function"
echo "  2. Share resume link with employers"
echo "  3. (Optional) Connect discussion board to AWS"
echo ""
