#!/bin/bash

echo "🚀 COMPLETE DEPLOYMENT - Everything!"
echo ""

cd "/Users/dave/Downloads/cloud guestboard"

echo "📋 What's Being Deployed:"
echo "  ✓ Discussion board"
echo "  ✓ Resume page"
echo "  ✓ LocalWeb Scout (NEW!)"
echo "  ✓ Updated homepage with LocalWeb Scout"
echo "  ✓ Email: david.smith.32@hotmail.com"
echo ""

# Check files exist
if [ ! -f "localweb/index.html" ]; then
    echo "❌ Error: localweb/index.html not found!"
    exit 1
fi

if [ ! -f "localweb/localweb.css" ]; then
    echo "❌ Error: localweb/localweb.css not found!"
    exit 1
fi

if [ ! -f "localweb/localweb.js" ]; then
    echo "❌ Error: localweb/localweb.js not found!"
    exit 1
fi

echo "✅ All files present"
echo ""

# Show what changed
echo "📝 Changes:"
echo "  • index.html: Added LocalWeb Scout project card"
echo "  • localweb/index.html: NEW - Lead management platform"
echo "  • localweb/localweb.css: NEW - Platform styles"
echo "  • localweb/localweb.js: NEW - Platform functionality"
echo ""

# Git operations
echo "📤 Committing to git..."
git add index.html localweb/

git commit -m "Add LocalWeb Scout - Business Lead Management Platform

LocalWeb Scout Features:
- Lead management dashboard with pipeline tracking
- Add/edit/delete business leads
- Filter by status (Discovered, Contacted, Proposal, Won)
- Professional portfolio showcase (6 industry templates)
- Activity tracking and statistics
- Local storage (no backend required yet)
- Fully responsive design

Portfolio Templates:
- Restaurant & Cafe ($799, 2 weeks)
- Retail & E-commerce ($1,499, 3 weeks)
- Professional Services ($999, 2 weeks)
- Healthcare & Medical ($1,299, 3 weeks)
- Real Estate ($1,199, 3 weeks)
- Construction & Trades ($899, 2 weeks)

Perfect for finding and converting small business website clients!

Also updated homepage to feature LocalWeb Scout alongside Dave Notes."

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "⏳ Wait 2-3 minutes for GitHub Pages to update, then visit:"
echo ""
echo "  🏠 Homepage: https://davedirty.com/"
echo "     (Now features LocalWeb Scout!)"
echo ""
echo "  🔍 LocalWeb Scout: https://davedirty.com/localweb"
echo "     (Business lead management platform)"
echo ""
echo "  📄 Resume: https://davedirty.com/resume"
echo "     (Professional resume)"
echo ""
echo "  💬 Discussion: https://davedirty.com/discussion"
echo "     (Community board)"
echo ""
echo "  📝 Dave Notes: https://davedirty.com/davenotes"
echo "     (Cloud-synced notes)"
echo ""
echo "🎉 Complete!"
echo ""
echo "Next Steps:"
echo "  1. Visit davedirty.com/localweb"
echo "  2. Add your first business lead"
echo "  3. Track it through your pipeline"
echo "  4. Show portfolio to potential clients"
echo "  5. Start winning web design projects!"
echo ""
