// Automated Website Generator
// Generates websites from templates in minutes

const WebsiteGenerator = {
    // Available templates
    templates: {
        restaurant: {
            pages: ['home', 'menu', 'about', 'contact', 'location'],
            features: ['menu-display', 'hours', 'reservations', 'gallery'],
            colors: ['#C92A2A', '#1a1a1a', '#f8f9fa']
        },
        retail: {
            pages: ['home', 'products', 'about', 'contact'],
            features: ['product-grid', 'cart', 'checkout', 'gallery'],
            colors: ['#44A08D', '#1a1a1a', '#f8f9fa']
        },
        professional: {
            pages: ['home', 'services', 'team', 'portfolio', 'contact'],
            features: ['services-list', 'team-bios', 'portfolio-grid', 'consultation'],
            colors: ['#764BA2', '#1a1a1a', '#f8f9fa']
        },
        healthcare: {
            pages: ['home', 'services', 'team', 'booking', 'contact'],
            features: ['appointment-booking', 'services-list', 'insurance-info', 'patient-portal'],
            colors: ['#2F80ED', '#1a1a1a', '#f8f9fa']
        }
    },
    
    // Generate website
    async generate(businessInfo, templateName) {
        console.log(`Generating ${templateName} website for ${businessInfo.name}`);
        
        const template = this.templates[templateName];
        const website = {
            domain: this.generateDomain(businessInfo.name),
            pages: {},
            assets: []
        };
        
        // Generate each page
        for (const pageName of template.pages) {
            website.pages[pageName] = await this.generatePage(
                pageName,
                businessInfo,
                template
            );
        }
        
        // Generate CSS
        website.css = this.generateCSS(template.colors, businessInfo);
        
        // Generate JavaScript
        website.js = this.generateJS(template.features);
        
        // Optimize for SEO
        website.seo = this.generateSEO(businessInfo);
        
        return website;
    },
    
    // Generate individual page
    async generatePage(pageName, business, template) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${business.name} - ${pageName}</title>
    <meta name="description" content="${business.description}">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav>
        <div class="logo">${business.name}</div>
        <ul>
            ${template.pages.map(p => `<li><a href="${p}.html">${p}</a></li>`).join('')}
        </ul>
    </nav>
    
    <main>
        ${this.generateContent(pageName, business)}
    </main>
    
    <footer>
        <p>&copy; 2024 ${business.name}. All rights reserved.</p>
        <p>${business.phone} | ${business.email}</p>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>
        `;
        
        return html;
    },
    
    // Generate page content based on type
    generateContent(pageName, business) {
        switch(pageName) {
            case 'home':
                return `
                    <section class="hero">
                        <h1>${business.name}</h1>
                        <p>${business.tagline}</p>
                        <a href="contact.html" class="btn">Get In Touch</a>
                    </section>
                `;
            case 'contact':
                return `
                    <section>
                        <h1>Contact Us</h1>
                        <p><strong>Phone:</strong> ${business.phone}</p>
                        <p><strong>Email:</strong> ${business.email}</p>
                        <p><strong>Address:</strong> ${business.address}</p>
                        <form class="contact-form">
                            <input type="text" placeholder="Name" required>
                            <input type="email" placeholder="Email" required>
                            <textarea placeholder="Message" required></textarea>
                            <button type="submit">Send Message</button>
                        </form>
                    </section>
                `;
            default:
                return `<section><h1>${pageName}</h1><p>Content for ${business.name}</p></section>`;
        }
    },
    
    // Generate domain name
    generateDomain(businessName) {
        return businessName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    },
    
    // Generate SEO meta tags
    generateSEO(business) {
        return {
            title: `${business.name} - ${business.city}`,
            description: `${business.description}. Located in ${business.city}.`,
            keywords: `${business.industry}, ${business.city}, ${business.name}`,
            ogImage: 'og-image.jpg'
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = WebsiteGenerator;
}
