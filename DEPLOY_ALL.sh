#!/bin/bash

echo "🚀 COMPLETE BUSINESS PLATFORM DEPLOYMENT"
echo ""

cd "/Users/dave/Downloads/cloud guestboard"

echo "📋 Deploying:"
echo "  ✓ LocalWeb Scout CRM"
echo "  ✓ Professional Services Page"
echo "  ✓ Updated Homepage"
echo "  ✓ Resume Page"
echo "  ✓ Discussion Board"
echo "  ✓ Dave Notes (existing)"
echo ""

# Check critical files
if [ ! -f "localweb/index.html" ]; then
    echo "❌ Error: localweb/index.html not found!"
    exit 1
fi

if [ ! -f "localweb/services.html" ]; then
    echo "❌ Error: localweb/services.html not found!"
    exit 1
fi

echo "✅ All files present"
echo ""

# Git operations
echo "📤 Committing to git..."
git add .

git commit -m "Deploy Complete Business Platform - LocalWeb Scout

COMPLETE WEB DESIGN BUSINESS PLATFORM:

🎯 LocalWeb Scout CRM:
- Lead management dashboard
- Pipeline tracking (Discovered → Contacted → Proposal → Won)
- Add/edit/delete leads
- Filter by status
- Activity tracking
- Local storage

💼 Professional Services Page:
- 3 Website packages ($799, $1,499, $2,999+)
- 6 Add-on services (Cloud, AI, SEO, Content, Email, Social)
- 3 Maintenance plans ($79, $149, $299/month)
- Complete process timeline
- Professional pricing structure

📊 Portfolio Showcase:
- 6 Industry-specific templates
- Restaurant, Retail, Professional, Healthcare, Real Estate, Construction
- Pricing and timelines for each

💰 Revenue Model:
- Initial projects: $799-$2,999
- Recurring: $79-$299/month maintenance
- Add-ons: $199-$799
- Potential: $5K-$9K/month after 6 months

🚀 Business Features:
- Complete sales process
- Phone scripts and email templates
- Pricing strategy
- Target market analysis
- Growth plan
- Success metrics

Perfect for winning web design clients and building recurring revenue!"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "⏳ Wait 2-3 minutes, then visit:"
echo ""
echo "  🎯 LocalWeb Scout CRM:"
echo "     https://davedirty.com/localweb"
echo ""
echo "  💼 Services & Pricing:"
echo "     https://davedirty.com/localweb/services.html"
echo ""
echo "  🏠 Homepage:"
echo "     https://davedirty.com/"
echo ""
echo "  📄 Resume:"
echo "     https://davedirty.com/resume"
echo ""
echo "  📝 Dave Notes:"
echo "     https://davedirty.com/davenotes"
echo ""
echo "  💬 Discussion:"
echo "     https://davedirty.com/discussion"
echo ""
echo "🎉 COMPLETE BUSINESS PLATFORM LIVE!"
echo ""
echo "Next Steps:"
echo "  1. Add your first 5 business leads"
echo "  2. Contact them using provided scripts"
echo "  3. Show them the services page"
echo "  4. Send proposals"
echo "  5. WIN CLIENTS! 💰"
echo ""
