document.addEventListener('DOMContentLoaded', () => {
    renderDailyChart();
    renderICUChart();
    renderPeakHours();
    
    const socket = io(window.location.origin);
    socket.on('emergency_alert', (data) => {
        showToast(data.message, 'error');
    });
    
    socket.on('mode_change', (data) => {
        const banner = document.getElementById('warning-banner');
        if (data.mode === 'disaster') banner.style.display = 'block';
        else banner.style.display = 'none';
    });
});

function renderDailyChart() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    const data = [420, 380, 510, 480, 600, 750, 410]; // Mock stats
    const maxVal = Math.max(...data) + 50;

    const chart = document.getElementById('daily-chart');
    
    data.forEach((val, i) => {
        const heightPct = (val / maxVal) * 100;
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar-fill" style="height: ${heightPct}%">
                <div class="bar-value">${val}</div>
            </div>
            <div class="bar-label">${days[i]}</div>
        `;
        chart.appendChild(col);
    });
}

function renderICUChart() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    const data = [70, 75, 82, 88, 92, 98, 85]; // Percentages
    const maxVal = 100;

    const chart = document.getElementById('icu-chart');
    
    data.forEach((val, i) => {
        const heightPct = (val / maxVal) * 100;
        let color = '#3b82f6';
        if (val >= 90) color = '#ef4444'; // Red if critical
        else if (val >= 80) color = '#f59e0b'; // Yellow if high

        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar-fill" style="height: ${heightPct}%; background: ${color}">
                <div class="bar-value">${val}%</div>
            </div>
            <div class="bar-label">${days[i]}</div>
        `;
        chart.appendChild(col);
    });
}

function renderPeakHours() {
    const amGrid = document.getElementById('am-hours');
    const pmGrid = document.getElementById('pm-hours');
    
    // Low, Med, High volumes
    const amVolumes = [0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 1, 1]; 
    const pmVolumes = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 0];
    
    function getBgClass(vol) {
        if(vol === 2) return 'bg-high';
        if(vol === 1) return 'bg-med';
        return 'bg-low';
    }

    amVolumes.forEach((v, i) => {
        amGrid.innerHTML += `
            <div>
                <div class="hour-box ${getBgClass(v)}" title="Vol Level: ${v}"></div>
                <div class="hour-label">${i === 0 ? '12a' : i + 'a'}</div>
            </div>
        `;
    });

    pmVolumes.forEach((v, i) => {
        pmGrid.innerHTML += `
            <div>
                <div class="hour-box ${getBgClass(v)}" title="Vol Level: ${v}"></div>
                <div class="hour-label">${i === 0 ? '12p' : i + 'p'}</div>
            </div>
        `;
    });
}

function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = '🔥';
    if(type === 'warning') icon = '⚠️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '🚨';
    toast.innerHTML = `<span>${icon}</span><div style="flex-grow: 1;">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
