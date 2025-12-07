#!/bin/bash

echo "🚀 Deploying your professional site to davedirty.com"
echo ""

cd "/Users/dave/Downloads/cloud guestboard"

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found in root!"
    echo "The homepage file is missing."
    exit 1
fi

# Check if home.css exists
if [ ! -f "home.css" ]; then
    echo "❌ Error: home.css not found in root!"
    exit 1
fi

# Check if home.js exists
if [ ! -f "home.js" ]; then
    echo "❌ Error: home.js not found in root!"
    exit 1
fi

echo "✅ All homepage files present"
echo ""

# Check folder structure
if [ ! -d "davenotes" ]; then
    echo "❌ Error: davenotes folder not found!"
    exit 1
fi

if [ ! -d "discussion" ]; then
    echo "❌ Error: discussion folder not found!"
    exit 1
fi

echo "✅ Folder structure correct"
echo ""

# Show current status
echo "📁 Current structure:"
ls -la index.html home.css home.js
echo ""
echo "davenotes/:"
ls -la davenotes/
echo ""
echo "discussion/:"
ls -la discussion/
echo ""

# Git operations
echo "📤 Committing changes..."
git add .
git commit -m "Deploy professional homepage with clean structure

- Professional portfolio homepage at root
- Dave Notes at /davenotes
- Discussion board at /discussion
- Organized folder structure"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Deployed!"
echo ""
echo "⏳ Wait 2-3 minutes for GitHub to deploy, then visit:"
echo "   🏠 https://davedirty.com/           (homepage)"
echo "   📝 https://davedirty.com/davenotes  (Dave Notes)"
echo "   💬 https://davedirty.com/discussion (Discussion)"
echo ""
