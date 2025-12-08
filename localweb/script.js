// LocalWeb Scout - JavaScript

function openModal(packageName) {
    document.getElementById('contactModal').classList.add('active');
    if (packageName) {
        document.getElementById('packageSelect').value = packageName;
    }
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('contactModal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Store submission
    const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
    submissions.push({
        ...data,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('submissions', JSON.stringify(submissions));
    
    // Show success message
    alert('Thank you! We\'ll review your project and send a detailed proposal within 24 hours.\n\nCheck your email at: ' + data.email);
    
    // Log to console for now (in production, send to backend)
    console.log('Form submission:', data);
    
    closeModal();
    e.target.reset();
}

// Close modal on outside click
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    
    // Add scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.package-card, .demo-item').forEach(el => {
        observer.observe(el);
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});
