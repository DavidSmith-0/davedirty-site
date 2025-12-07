#!/bin/bash

# Cleanup and Organization Script for davedirty-site
# This script will organize your repo and remove unnecessary files

cd "/Users/dave/Downloads/cloud guestboard"

echo "🧹 Cleaning up and organizing your repository..."
echo ""

# Create archive folder for old documentation
mkdir -p _archive/old-docs
mkdir -p _archive/old-scripts

echo "📦 Moving old documentation to _archive..."
mv ADMIN_GUIDE.md _archive/old-docs/ 2>/dev/null
mv AWS_INTEGRATION_GUIDE.md _archive/old-docs/ 2>/dev/null
mv AWS_INTEGRATION_SUMMARY.md _archive/old-docs/ 2>/dev/null
mv AWS_SETUP_COMPLETE_GUIDE.md _archive/old-docs/ 2>/dev/null
mv DEPLOYMENT_CHECKLIST.md _archive/old-docs/ 2>/dev/null
mv DEPLOYMENT_GUIDE.md _archive/old-docs/ 2>/dev/null
mv DESIGN_SPEC.md _archive/old-docs/ 2>/dev/null
mv FILE_STRUCTURE.md _archive/old-docs/ 2>/dev/null
mv FIXES_APPLIED.md _archive/old-docs/ 2>/dev/null
mv FIX_HOMEPAGE_ISSUE.md _archive/old-docs/ 2>/dev/null
mv FUTURE_ENHANCEMENTS.md _archive/old-docs/ 2>/dev/null
mv LAMBDA_SETUP.md _archive/old-docs/ 2>/dev/null
mv NEXT_STEPS.md _archive/old-docs/ 2>/dev/null
mv QUICK_REFERENCE.md _archive/old-docs/ 2>/dev/null
mv QUICK_START.md _archive/old-docs/ 2>/dev/null
mv README_START_HERE.md _archive/old-docs/ 2>/dev/null

echo "📦 Moving old scripts to _archive..."
mv check-resources.sh _archive/old-scripts/ 2>/dev/null
mv complete-aws-setup.sh _archive/old-scripts/ 2>/dev/null
mv deploy-everything.sh _archive/old-scripts/ 2>/dev/null
mv deploy-final.sh _archive/old-scripts/ 2>/dev/null
mv find-resources.sh _archive/old-scripts/ 2>/dev/null
mv master-setup-fixed.sh _archive/old-scripts/ 2>/dev/null
mv master-setup.sh _archive/old-scripts/ 2>/dev/null
mv setup-aws.sh _archive/old-scripts/ 2>/dev/null
mv setup-complete.sh _archive/old-scripts/ 2>/dev/null
mv simple-check.sh _archive/old-scripts/ 2>/dev/null
mv update-dave-notes-with-cloud.sh _archive/old-scripts/ 2>/dev/null

echo "📦 Moving old Lambda files to _archive..."
mkdir -p _archive/lambda-functions
mv createMessage.zip _archive/lambda-functions/ 2>/dev/null
mv createNote.mjs _archive/lambda-functions/ 2>/dev/null
mv createNote.zip _archive/lambda-functions/ 2>/dev/null
mv deleteNote.mjs _archive/lambda-functions/ 2>/dev/null
mv deleteNote.zip _archive/lambda-functions/ 2>/dev/null
mv index.mjs _archive/lambda-functions/ 2>/dev/null
mv lambda-createMessage.mjs _archive/lambda-functions/ 2>/dev/null
mv lambda-listMessages.mjs _archive/lambda-functions/ 2>/dev/null
mv listMessages.zip _archive/lambda-functions/ 2>/dev/null
mv listNotes.mjs _archive/lambda-functions/ 2>/dev/null
mv listNotes.zip _archive/lambda-functions/ 2>/dev/null
mv uploadFile.mjs _archive/lambda-functions/ 2>/dev/null
mv uploadFile.zip _archive/lambda-functions/ 2>/dev/null
mv payload.json _archive/lambda-functions/ 2>/dev/null

echo "📦 Moving old config files to _archive..."
mkdir -p _archive/old-config
mv aws-config.js _archive/old-config/ 2>/dev/null
mv aws-config.txt _archive/old-config/ 2>/dev/null
mv resources-output.txt _archive/old-config/ 2>/dev/null

echo "📦 Moving old app files to _archive..."
mv app.js _archive/ 2>/dev/null
mv styles.css _archive/ 2>/dev/null

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📁 Your repository structure:"
tree -L 2 -I '.git|.DS_Store|_archive'

echo ""
echo "🗂️  Files that should be in your repo:"
echo ""
echo "Root (website homepage):"
echo "  ├── index.html         (professional homepage)"
echo "  ├── home.css           (homepage styles)"
echo "  ├── home.js            (homepage scripts)"
echo "  ├── README.md          (project info)"
echo "  └── CNAME              (domain config)"
echo ""
echo "Folders:"
echo "  ├── davenotes/         (Dave Notes app)"
echo "  │   ├── index.html"
echo "  │   ├── dave-notes.js"
echo "  │   └── dave-notes.css"
echo "  └── discussion/        (Discussion board)"
echo "      └── index.html"
echo ""
echo "Archive (old files, not deployed):"
echo "  └── _archive/          (old docs, scripts, configs)"
echo ""
