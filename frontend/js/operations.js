const BACKEND_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
    const socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
        console.log('Operations Center connected');
    });

    socket.on('hospital_update', () => {
        fetchHospitals();
    });

    socket.on('emergency_alert', (data) => {
        showToast(data.message, 'error');
        addIncident(`🚨 SYS ALERT: ${data.message}`);
    });

    socket.on('mode_change', (data) => {
        const banner = document.getElementById('warning-banner');
        if (data.mode === 'disaster') {
            banner.style.display = 'block';
            addIncident(`⚠️ DISASTER MODE ACTIVATED GLOBALLY`, 'warning');
        } else {
            banner.style.display = 'none';
            addIncident(`✅ System returned to NORMAL mode`, 'success');
        }
    });

    await fetchHospitals();
    
    // Seed initial incidents
    addIncident("Accident reported on NH48 - 3 patients incoming");
    addIncident("Ambulance AMB-101 dispatched to Andheri East");
    
    // Start simulations
    setInterval(simulateIncidents, 8000);
    renderTransfers();
});

async function fetchHospitals() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/hospitals`);
        const hospitals = await res.json();
        renderHeatmap(hospitals);
    } catch (e) {
        console.error("Ops fetch error", e);
    }
}

function renderHeatmap(hospitals) {
    const container = document.getElementById('heatmap-container');
    container.innerHTML = '';

    hospitals.forEach(h => {
        const total = h.capacity.totalBeds + h.capacity.totalICU;
        const occupied = h.capacity.occupiedBeds + h.capacity.occupiedICU;
        const fill = occupied / total;
        
        let mapClass = 'heatmap-green';
        let statusText = 'Stable';
        
        if (fill > 0.9) { mapClass = 'heatmap-red'; statusText = 'Critical Load'; }
        else if (fill > 0.75) { mapClass = 'heatmap-yellow'; statusText = 'Busy'; }

        container.innerHTML += `
            <div class="heatmap-card ${mapClass}">
                <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">${h.name}</div>
                <div style="font-size: 2rem;">${(fill*100).toFixed(1)}%</div>
                <div style="font-size: 0.8rem; font-weight: normal; margin-top: 0.5rem; opacity: 0.9;">${statusText}</div>
            </div>
        `;
    });
}

function addIncident(msg, type = 'info') {
    const feed = document.getElementById('incident-feed');
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    let icon = '🔵';
    if(type==='warning') icon = '⚠️';
    if(type==='error' || msg.includes('🚨')) icon = '🚨';
    if(type==='success') icon = '✅';

    const div = document.createElement('div');
    div.className = 'incident-item';
    div.innerHTML = `
        <div class="incident-time">${timeStr}</div>
        <div><strong>${icon}</strong> ${msg}</div>
    `;
    
    feed.prepend(div);
    if(feed.children.length > 20) feed.removeChild(feed.lastChild);
}

const incidentsPool = [
    "Ambulance AMB-102 dispatched to Bandra Kurla Complex",
    "Minor trauma reported at Dadar Station",
    "Patient transferred from ICU to General Ward at Phoenix",
    "Emergency response team deployed to Powai",
    "System resource recalculation completed",
    "New specialist physician logged into SRV Goregaon",
    "Ambulance AMB-103 returning to base"
];

function simulateIncidents() {
    if(Math.random() > 0.3) {
        const msg = incidentsPool[Math.floor(Math.random() * incidentsPool.length)];
        addIncident(msg);
    }
}

function renderTransfers() {
    const tbody = document.getElementById('transfer-tbody');
    const transfers = [
        { id: "TRF-810", src: "Phoenix Hosp", dest: "Karuna Hosp", prio: "High", status: "transit", class: "badge-transit", statusText: "In Transit" },
        { id: "TRF-812", src: "SRV Goregaon", dest: "Phoenix Hosp", prio: "Medium", status: "pending", class: "badge-pending", statusText: "Pending Auth" },
        { id: "TRF-809", src: "Karuna Hosp", dest: "SRV Goregaon", prio: "Low", status: "done", class: "badge-completed", statusText: "Completed" },
    ];
    
    transfers.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td style="font-family: monospace; font-weight: bold;">${t.id}</td>
                <td>${t.src}</td>
                <td>${t.dest}</td>
                <td>${t.prio}</td>
                <td><span class="badge-status ${t.class}">${t.statusText}</span></td>
            </tr>
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
