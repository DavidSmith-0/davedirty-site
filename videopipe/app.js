// Simple demo functionality
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const jobsList = document.getElementById('jobsList');

let jobCounter = 0;

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processVideo(file);
    }
});

function processVideo(file) {
    jobCounter++;
    const jobId = `job-${jobCounter}`;
    const size = (file.size / 1024 / 1024).toFixed(1) + ' MB';
    
    if (jobsList.querySelector('.text-muted')) {
        jobsList.innerHTML = '';
    }
    
    const jobDiv = document.createElement('div');
    jobDiv.className = 'job-item';
    jobDiv.id = jobId;
    jobDiv.innerHTML = `
        <div class="job-header">
            <div class="job-name">${file.name}</div>
            <div class="job-status status-processing">Processing</div>
        </div>
        <div class="text-sm">${size} • Uploaded just now</div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
    `;
    
    jobsList.insertBefore(jobDiv, jobsList.firstChild);
    
    // Simulate processing
    simulateProgress(jobId);
}

function simulateProgress(jobId) {
    const jobDiv = document.getElementById(jobId);
    const progressFill = jobDiv.querySelector('.progress-fill');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            completeJob(jobId);
        }
        progressFill.style.width = progress + '%';
    }, 500);
}

function completeJob(jobId) {
    const jobDiv = document.getElementById(jobId);
    const statusBadge = jobDiv.querySelector('.job-status');
    statusBadge.textContent = 'Complete';
    statusBadge.className = 'job-status status-complete';
    
    // Add download button
    const header = jobDiv.querySelector('.job-header');
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '⬇️ Download';
    downloadBtn.style.cssText = 'background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;';
    downloadBtn.onclick = () => alert('In production, this would download your processed video from S3!');
    header.appendChild(downloadBtn);
}
