const BACKEND_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch initial data and mode
    await fetchDashboardData();
    await fetchSystemMode();
    
    // 2. Initialize Socket.io
    const socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
        console.log('Connected to real-time server');
    });
    
    socket.on('hospital_update', (hospital) => {
        console.log('Hospital updated:', hospital);
        fetchDashboardData();
    });
    
    socket.on('emergency_alert', (data) => {
        showToast(data.message, 'error');
    });

    socket.on('mode_change', (data) => {
        updateEmergencyModeUI(data.mode === 'disaster');
        if (data.mode === 'disaster') showToast("Disaster Mode Activated", "warning");
    });
    
    // Bind buttons
    document.getElementById('emergency-toggle').addEventListener('change', toggleEmergencyMode);
    document.getElementById('btn-surge').addEventListener('click', simulateSurge);

    // 3. Set up simulation loop
    setInterval(simulateCapacityChange, 10000); 
});

async function fetchSystemMode() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/mode`);
        if(res.ok) {
            const data = await res.json();
            const isDisaster = data.mode === 'disaster';
            document.getElementById('emergency-toggle').checked = isDisaster;
            updateEmergencyModeUI(isDisaster);
        }
    } catch(e) { console.error('Fetch mode error', e) }
}

function updateEmergencyModeUI(isDisaster) {
    const banner = document.getElementById('warning-banner');
    if (isDisaster) {
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

async function toggleEmergencyMode(e) {
    const isDisaster = e.target.checked;
    const mode = isDisaster ? 'disaster' : 'normal';
    try {
        await fetch(`${BACKEND_URL}/api/toggle-mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
    } catch(e) { console.error('Toggle mode error', e) }
}

async function simulateSurge() {
    try {
        await fetch(`${BACKEND_URL}/api/simulate-surge`, { method: 'POST' });
        // The server will emit 'hospital_update' to refresh everyone automatically
    } catch (e) { console.error('Simulate surge err', e) }
}

async function fetchDashboardData() {
    try {
        const [hospitalsRes, ambulancesRes, patientsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/hospitals`),
            fetch(`${BACKEND_URL}/api/ambulances`),
            fetch(`${BACKEND_URL}/api/patients`)
        ]);
        
        const hospitals = await hospitalsRes.json();
        const ambulances = await ambulancesRes.json();
        const patients = await patientsRes.json();
        
        // Decrement Golden Hours locally each fetch to simulate time passing
        patients.forEach(p => {
            if (p.goldenHour) p.goldenHour -= 1; 
        });

        updateMetrics(hospitals, ambulances, patients);
        updatePatientQueue(patients);
        updateAmbulanceList(ambulances);
        
    } catch (err) {
        console.error("Error fetching data:", err);
        showAlert("Error connecting to server. Is the backend running?");
    }
}

function updateMetrics(hospitals, ambulances, patients) {
    let totalBeds = 0;
    let occBeds = 0;
    let totalICU = 0;
    let occICU = 0;
    
    hospitals.forEach(h => {
        totalBeds += h.capacity.totalBeds;
        occBeds += h.capacity.occupiedBeds;
        totalICU += h.capacity.totalICU;
        occICU += h.capacity.occupiedICU;
    });
    
    document.getElementById('total-capacity').textContent = `${occBeds} / ${totalBeds}`;
    document.getElementById('icu-capacity').textContent = `${occICU} / ${totalICU}`;
    
    // Progress Bars
    const bedPct = totalBeds > 0 ? (occBeds / totalBeds) : 0;
    const icuPct = totalICU > 0 ? (occICU / totalICU) : 0;
    
    updateProgressBar('total-bar', bedPct);
    updateProgressBar('icu-bar', icuPct);

    // Update active ambulances
    const activeAmbs = ambulances.filter(a => a.status === 'en_route').length;
    document.getElementById('active-ambulances').textContent = activeAmbs;
    
    // Update patients waiting
    document.getElementById('patients-waiting').textContent = patients.length;

    // Advanced features
    updateSmartStatus(bedPct, icuPct, patients.length);
    generatePredictiveLoad(bedPct, icuPct);
    updateStaffPanel(hospitals.length);
    generateRedistributionSuggestions(hospitals);
}

function updateProgressBar(id, pct) {
    const bar = document.getElementById(id);
    if (!bar) return;
    const percentage = Math.round(pct * 100);
    bar.style.width = `${percentage}%`;
    
    if (pct > 0.9) bar.style.background = 'var(--danger-dark)';
    else if (pct > 0.75) bar.style.background = 'var(--danger)';
    else if (pct > 0.5) bar.style.background = 'var(--warning)';
    else bar.style.background = 'var(--success)';
}

function updateSmartStatus(bedPct, icuPct, queueLen) {
    const dot = document.getElementById('system-status-dot');
    const text = document.getElementById('system-status-text');
    
    // Remove old classes
    dot.className = 'dot';
    
    if (bedPct > 0.9 || icuPct > 0.9 || queueLen > 20) {
        dot.classList.add('red');
        dot.style.backgroundColor = 'var(--danger-dark)';
        text.textContent = 'SYSTEM OVERFLOW';
        text.style.color = 'var(--danger-dark)';
    } else if (bedPct > 0.75 || icuPct > 0.75 || queueLen > 10) {
        dot.classList.add('red');
        dot.style.backgroundColor = 'var(--danger)';
        text.textContent = 'CRITICAL LOAD';
        text.style.color = 'var(--danger)';
    } else if (bedPct > 0.5 || icuPct > 0.5 || queueLen > 5) {
        dot.classList.add('yellow');
        dot.style.backgroundColor = 'var(--warning)';
        text.textContent = 'BUSY';
        text.style.color = 'var(--warning)';
    } else {
        dot.classList.add('green');
        dot.style.backgroundColor = 'var(--success)';
        text.textContent = 'STABLE';
        text.style.color = 'var(--success)';
    }
}

function generatePredictiveLoad(currentBedPct, currentIcuPct) {
    // Simulate 1-2 hr projection based on some random logic to look realistic
    const bedPred = Math.min(1.0, currentBedPct * (1 + (Math.random() * 0.15)));
    const icuPred = Math.min(1.0, currentIcuPct * (1 + (Math.random() * 0.2)));
    
    document.getElementById('ai-bed-pred').textContent = `${Math.round(bedPred * 100)}%`;
    document.getElementById('ai-icu-pred').textContent = `${Math.round(icuPred * 100)}%`;
    
    const riskEl = document.getElementById('ai-risk-level');
    const maxPred = Math.max(bedPred, icuPred);
    if (maxPred > 0.85) {
        riskEl.textContent = 'HIGH';
        riskEl.style.color = 'var(--danger)';
    } else if (maxPred > 0.65) {
        riskEl.textContent = 'MEDIUM';
        riskEl.style.color = 'var(--warning)';
    } else {
        riskEl.textContent = 'LOW';
        riskEl.style.color = 'var(--success)';
    }
}

function updateStaffPanel(hospitals) {
    const hospitalCount = hospitals.length;
    // Generate some mock staff numbers
    const docs = 35 + hospitalCount * 2;
    const specs = 12 + hospitalCount;
    const responseTeams = 4 + Math.floor(hospitalCount / 2);
    
    document.getElementById('staff-doctors').textContent = docs;
    document.getElementById('staff-specialists').textContent = specs;
    
    // Add department string from the first hospital as a general indicator
    let deptStr = "--";
    if (hospitals.length > 0) {
        const d = hospitals[0].departments;
        if(d) deptStr = `Cardio: ${d.cardiology} | Trauma: ${d.trauma} | Neuro: ${d.neurology}`;
    }
    document.getElementById('staff-er').innerHTML = `${responseTeams} <br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${deptStr}</span>`;
}

function generateRedistributionSuggestions(hospitals) {
    const box = document.getElementById('redistribution-box');
    if (hospitals.length < 2) {
        box.innerHTML = "Not enough network data.";
        return;
    }
    
    // Find highest load and lowest load
    let maxLoad = -1; let maxHosp = null;
    let minLoad = 2; let minHosp = null;
    
    hospitals.forEach(h => {
        const load = (h.capacity.occupiedICU / h.capacity.totalICU) || 0;
        if (load > maxLoad) { maxLoad = load; maxHosp = h; }
        if (load < minLoad) { minLoad = load; minHosp = h; }
    });
    
    if (maxLoad > 0.8 && minLoad < 0.6 && maxHosp && minHosp && maxHosp._id !== minHosp._id) {
        box.innerHTML = `
            <div style="background: #fffbeb; border: 1px solid var(--warning); padding: 0.75rem; border-radius: 8px;">
                <span style="color: var(--warning); display:block; font-weight:bold; margin-bottom: 0.25rem;">Recommendation:</span>
                Transfer <strong>2-3 ICU patients</strong> from <strong>${maxHosp.name}</strong> to <strong>${minHosp.name}</strong> to stabilize regional capacity.
            </div>`;
    } else {
        box.innerHTML = `<span style="color: var(--success); font-weight: 500;">✓ Network resources balanced optimally.</span>`;
    }
}

function updatePatientQueue(patients) {
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';
    
    // Ensure scores are there
    patients.forEach(p => { if(!p.severityScore) p.severityScore = Math.floor(Math.random()*40)+20; });
    
    // Sort logic by score highest first
    patients.sort((a, b) => b.severityScore - a.severityScore);
    
    // Keep only top 5 patients to avoid UI clutter
    const displayPatients = patients.slice(0, 5);
    
    displayPatients.forEach(p => {
        const li = document.createElement('li');
        li.className = 'queue-item';
        
        let color = '#22c55e';
        if (p.severityScore > 80) color = '#ef4444';
        else if (p.severityScore > 50) color = '#f59e0b';
        
        let goldenHtml = '';
        if (p.goldenHour !== null && p.goldenHour !== undefined && p.goldenHour > 0) {
            goldenHtml = `<div style="font-size: 0.75rem; color: #ef4444; font-weight: bold; margin-top: 0.25rem;">⏱ Golden Time Remaining: ${p.goldenHour} mins</div>`;
        } else if (p.goldenHour !== null && p.goldenHour !== undefined && p.goldenHour <= 0) {
            goldenHtml = `<div style="font-size: 0.75rem; color: #b91c1c; font-weight: bold; margin-top: 0.25rem;">⚠️ Golden Time EXPIRED</div>`;
        }

        li.innerHTML = `
            <div style="flex-grow: 1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${p.name}</strong> <span style="font-size:0.7rem; color:gray;">(${p._id})</span>
                    </div>
                    <div>
                        <span class="severity-score-badge">Sc: ${p.severityScore}</span>
                        <span class="severity-indicator severity-${p.severity}">${p.severity}</span>
                    </div>
                </div>
                ${goldenHtml}
                <div class="priority-bar-container">
                    <div class="priority-bar-fill" style="width: ${p.severityScore}%; background: ${color};"></div>
                </div>
            </div>
        `;
        queueList.appendChild(li);
    });
}

function updateAmbulanceList(ambulances) {
    const ambList = document.getElementById('amb-list');
    ambList.innerHTML = '';
    
    const active = ambulances.filter(a => a.status === 'en_route');
    
    active.forEach(a => {
        const li = document.createElement('li');
        li.className = 'amb-item';
        
        const hospName = a.assignedHospital ? a.assignedHospital.name : 'Unknown';
        
        li.innerHTML = `
            <div>
                <strong>${a.vehicleId}</strong>
                <div class="subtitle">Dest: ${hospName}</div>
            </div>
            <div class="text-right">
                <div class="font-bold">${a.eta} min</div>
                <div class="subtitle">ETA</div>
            </div>
        `;
        ambList.appendChild(li);
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
    
    toast.innerHTML = `
        <span>${icon}</span>
        <div style="flex-grow: 1;">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ----------------------------------------------------
// SIMULATION LOGIC: Randomly update hospital capacities
// ----------------------------------------------------
async function simulateCapacityChange() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/hospitals`);
        const hospitals = await res.json();
        
        if (hospitals.length === 0) return;
        
        // Pick a random hospital
        const target = hospitals[Math.floor(Math.random() * hospitals.length)];
        
        // Simulate gaining a patient but don't store/fill the whole capacity
        target.capacity.occupiedBeds += 1;
        if (target.capacity.occupiedBeds > target.capacity.totalBeds * 0.95) {
            target.capacity.occupiedBeds = Math.floor(target.capacity.totalBeds * 0.95);
        }
        
        // Post update
        await fetch(`${BACKEND_URL}/api/hospitals/${target._id}/capacity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ capacity: target.capacity })
        });
        
    } catch (e) {
        console.log('Simulation update failed', e);
    }
}
