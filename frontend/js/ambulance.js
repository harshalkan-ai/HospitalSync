const BACKEND_URL = window.location.origin;
const MY_AMB_ID = 'AMB-102'; // Simulated logged-in ambulance
let hospitalsData = [];
let systemMode = 'normal';

document.addEventListener('DOMContentLoaded', async () => {
    const socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
        console.log('Ambulance connected to real-time server');
    });

    socket.on('emergency_alert', (data) => {
        showToast(data.message, 'error');
    });

    socket.on('hospital_update', (hospital) => {
        // Update local dataset and re-render if needed
        const idx = hospitalsData.findIndex(h => h._id === hospital._id);
        if (idx !== -1) {
            hospitalsData[idx] = hospital;
            renderHospitalsList(); // Re-render to reflect new capacities
        }
    });

    socket.on('mode_change', (data) => {
        systemMode = data.mode;
        // Recalculate if we already have routes shown
        if(document.getElementById('hospital-options').innerHTML.includes('Route Here')) {
            calculateRoutes();
        }
    });

    document.getElementById('btn-find-hospital').addEventListener('click', calculateRoutes);
    
    // Pre-fetch data
    await fetchMode();
    await fetchHospitals();
});

async function fetchMode() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/mode`);
        if(res.ok) {
            const data = await res.json();
            systemMode = data.mode;
        }
    } catch (e) { console.error(e); }
}

async function fetchHospitals() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/hospitals`);
        hospitalsData = await res.json();
    } catch (e) {
        console.error(e);
    }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2-lat1) * (Math.PI/180);
    const dLon = (lon2-lon1) * (Math.PI/180); 
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
}

let currentAmbulanceLoc = { lat: 19.1200, lng: 72.8500 }; // Mumbai location

function calculateRoutes() {
    if (hospitalsData.length === 0) return;
    
    const enrichedHospitals = hospitalsData.map(h => {
        // Realistic Haversine Distance
        const distanceKm = getDistanceFromLatLonInKm(
            currentAmbulanceLoc.lat, currentAmbulanceLoc.lng,
            h.location.lat, h.location.lng
        );
        
        // Exact city ETA logic at ~40km/h
        const etaMinutes = Math.round((distanceKm / 40) * 60) + 1; // 1 min dispatch delay
        let distText = distanceKm < 1 ? Math.round(distanceKm * 1000) + " m" : distanceKm.toFixed(1) + " km";

        // Capacity logic
        const total = h.capacity.totalBeds + h.capacity.totalICU;
        const occupied = h.capacity.occupiedBeds + h.capacity.occupiedICU;
        const fillPercentage = occupied / total;
        
        let priorityScore = distanceKm;
        let reasons = [];
        let confidenceScore = 100;
        let routeRisk = "Low (Optimal Conditions)";
        
        if (distanceKm < 5) {
            reasons.push("Closest distance");
            routeRisk = "Low (Short distance)";
        } else if (distanceKm > 15) {
            routeRisk = "High (Long distance + Traffic)";
            confidenceScore -= 20;
        } else {
            routeRisk = "Medium (Moderate traffic)";
            confidenceScore -= 10;
        }

        if (h.capacity.totalICU - h.capacity.occupiedICU > 0) reasons.push("ICU beds available");
        else { reasons.push("Warning: No ICU Availability"); confidenceScore -= 15; }
        
        if (fillPercentage < 0.75) reasons.push("Lower patient queue");
        else { confidenceScore -= Math.floor(fillPercentage * 20); }
        
        if (systemMode === 'disaster') {
            const availableBeds = total - occupied;
            priorityScore = -availableBeds * 20; // Prioritize strictly by available capacity
            if (availableBeds > 0) reasons.push("Disaster Mode: Highest Capacity Priority");
            if (fillPercentage > 0.95) routeRisk = "CRITICAL (Hospital at absolute max limit)";
        } else {
            if (fillPercentage > 0.9) { priorityScore += 100; routeRisk = "High (Severe Bottleneck)"; }
            else if (fillPercentage > 0.75) { priorityScore += 10; }
        }

        // Add final derived stats
        reasons.push("Routing Confidence: " + confidenceScore + "%");
        reasons.push("Route Risk: " + routeRisk);
        
        return {
            ...h,
            distanceKm,
            distText,
            eta: etaMinutes,
            fillPercentage,
            priorityScore,
            reasons
        };
    });
    
    // Sort by priority score
    enrichedHospitals.sort((a, b) => a.priorityScore - b.priorityScore);
    
    // Identifiers for Fastest, Closest
    let minE = Math.min(...enrichedHospitals.map(h => h.eta));
    let minD = Math.min(...enrichedHospitals.map(h => h.distanceKm));
    enrichedHospitals.forEach(h => {
        h.isFastest = (h.eta === minE);
        h.isClosest = (h.distanceKm === minD);
    });

    // Save to global for rendering
    hospitalsData = enrichedHospitals;
    renderHospitalsList();
}

function renderHospitalsList() {
    const container = document.getElementById('hospital-options');
    container.innerHTML = '';
    
    hospitalsData.forEach(h => {
        const etaText = h.eta ? h.eta + " min" : '-- min';
        
        // Status from capacity
        const total = h.capacity.totalBeds + h.capacity.totalICU;
        const occupied = h.capacity.occupiedBeds + h.capacity.occupiedICU;
        const fill = occupied / total;
        
        let statusBadge = '🟢 Normal';
        let statusColor = 'var(--success)';
        let bestCapacityBadge = '';
        
        if (fill > 0.9) {
            statusBadge = '🔴 CRITICAL/FULL';
            statusColor = 'var(--danger)';
        } else if (fill > 0.75) {
            statusBadge = '🟡 Busy';
            statusColor = 'var(--warning)';
        } else {
            bestCapacityBadge = ' <span style="background:var(--success);color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:5px;">Best Capacity</span>';
        }
        
        const fastestBadge = h.isFastest ? ' <span style="background:var(--primary);color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:5px;">Fastest Route</span>' : '';
        const closestBadge = h.isClosest ? ' <span style="background:#8b5cf6;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:5px;">Closest</span>' : '';
        
        const el = document.createElement('div');
        el.className = 'option-card';
        
        let reasonsHtml = '';
        if (h.reasons && h.reasons.length > 0) {
            const list = h.reasons.map(r => "✔ " + r).join("<br>");
            reasonsHtml = '<div class="routing-explanation"><strong>Why Selected:</strong><br>' + list + '</div>';
        }

        el.innerHTML = `
            <div class="option-details">
                <h4>${h.name} ${fastestBadge} ${closestBadge} ${bestCapacityBadge}</h4>
                <div class="subtitle" style="color: ${statusColor}; font-weight:bold;">${statusBadge} - ${(fill*100).toFixed(1)}% Full</div>
                <div class="subtitle" style="margin-top:0.25rem; font-weight:600;">Distance: ${h.distText}</div>
                ${reasonsHtml}
            </div>
            <div style="text-align:right;">
                <h3 style="color: var(--primary); margin-bottom: 0.5rem;" id="eta-display-text-${h._id}">ETA: ${etaText}</h3>
                <button class="btn btn-primary btn-sm" onclick="selectDestination('${h._id}')" ${fill > 0.95 ? 'disabled style="background:gray;"' : ''}>Route Here</button>
            </div>
        `;
        container.appendChild(el);
    });
}

window.selectDestination = function(hId) {
    const hospital = hospitalsData.find(h => h._id === hId);
    
    const container = document.getElementById('hospital-options');
    const safeHospName = hospital ? hospital.name : 'Destination';
    
    container.innerHTML = `
        <div style="padding: 1rem; border: 1px solid var(--success); border-radius: 8px; background: #ecfdf5; margin-bottom: 1rem;">
            <p style="color:var(--success); font-weight:bold; text-align:center;">Navigation System Engaged to ${safeHospName}.</p>
        </div>
        
        <div class="directions-list card" style="margin-top: 1rem; padding: 1.5rem;">
            <h4 style="margin-bottom: 1rem; color: var(--text-main); font-weight: 600;">📍 Turn-by-Turn Directions</h4>
            <ul style="list-style-type: none; padding-left: 0;">
                <li style="padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="color: var(--primary);">⬆️</span> 
                    <span>Head straight on Current Location Ave for ${hospital ? hospital.distText : '1.2 km'}</span>
                </li>
                <li style="padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="color: var(--primary);">➡️</span> 
                    <span>Turn right onto Main Boulevard</span>
                </li>
                <li style="padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="color: var(--primary);">⬅️</span> 
                    <span>Turn left at 4th Street intersection</span>
                </li>
                <li style="padding: 0.75rem 0; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="color: var(--success);">🏥</span> 
                    <span style="font-weight: bold;" id="nav-arrival-text">Arrive at ${safeHospName} Emergency Bay</span>
                </li>
            </ul>
        </div>
        <div style="text-align: center; margin-top: 1rem;">
            <h2 id="eta-display-text" style="color: var(--primary);">ETA: ${hospital ? hospital.eta : '--'} min</h2>
        </div>
    `;

    // Determine map positions
    let hospTargetId = 'hosp-1';
    if (hospital && (hospital.name.includes('City') || hospital.name.includes('Phoenix'))) hospTargetId = 'hosp-1';
    else if (hospital && (hospital.name.includes('Metro') || hospital.name.includes('Karuna'))) hospTargetId = 'hosp-2';

    const hospEl = document.getElementById(hospTargetId);
    const mapEl = document.querySelector('.simulated-map');
    const ambMarker = document.getElementById('amb-marker');
    
    if (hospEl && ambMarker && mapEl) {
        // Get coordinates relative to map container
        const hospRect = hospEl.getBoundingClientRect();
        const ambRect = ambMarker.getBoundingClientRect();
        const mapRect = mapEl.getBoundingClientRect();
        
        const startX = ambRect.left + ambRect.width/2 - mapRect.left;
        const startY = ambRect.top + ambRect.height/2 - mapRect.top;
        const endX = hospRect.left + hospRect.width/2 - mapRect.left;
        const endY = hospRect.top + hospRect.height/2 - mapRect.top;
        
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const existingLine = document.getElementById('route-line');
        if (existingLine) existingLine.remove();

        const routeLine = document.createElement('div');
        routeLine.id = 'route-line';
        routeLine.style.position = 'absolute';
        routeLine.style.height = '4px';
        routeLine.style.backgroundColor = 'var(--primary)';
        routeLine.style.transformOrigin = '0 50%';
        routeLine.style.transform = `rotate(${angle}deg)`;
        routeLine.style.width = '0px'; 
        routeLine.style.left = startX + 'px';
        routeLine.style.top = startY + 'px';
        routeLine.style.zIndex = '5';
        routeLine.style.opacity = '0.7';
        routeLine.style.transition = 'width 1.5s ease-out';
        mapEl.appendChild(routeLine);

        // Animate line draw
        setTimeout(() => { routeLine.style.width = length + 'px'; }, 100);

        // Clear previous animation loop
        if (window.ambAnimInterval) clearInterval(window.ambAnimInterval);

        let progress = 0;
        let currentEta = hospital ? hospital.eta : 0;
        const etaElement = document.getElementById('eta-display-text');
        
        hospEl.classList.add('pulse-dest');

        // Stop the default CSS animation if it exists, use JS exact movement
        ambMarker.classList.remove('moving-ambulance');
        ambMarker.style.transition = 'left 2s linear, top 2s linear';

        window.ambAnimInterval = setInterval(() => {
            progress += 0.05; // 5% per tick
            if (progress >= 1) {
                clearInterval(window.ambAnimInterval);
                ambMarker.style.left = ((endX/mapRect.width)*100) + '%';
                ambMarker.style.top = ((endY/mapRect.height)*100) + '%';
                if (etaElement) etaElement.innerHTML = "Arrived at " + safeHospName;
                hospEl.classList.remove('pulse-dest');
                showToast("Ambulance arrived at " + safeHospName, 'success');
                return;
            }
            
            const currX = startX + dx * progress;
            const currY = startY + dy * progress;
            
            ambMarker.style.left = ((currX/mapRect.width)*100) + '%';
            ambMarker.style.top = ((currY/mapRect.height)*100) + '%';
            
            if (etaElement && currentEta > 1) {
                const newEta = Math.ceil((hospital ? hospital.eta : 0) * (1 - progress));
                if (newEta < currentEta && newEta > 0) {
                    currentEta = newEta;
                    etaElement.innerHTML = "ETA: " + currentEta + " min";
                }
            }
        }, 2000); // Ticks every 2s
    }
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
