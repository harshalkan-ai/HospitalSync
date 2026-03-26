const express = require('express');
const router = express.Router();

let hospitals = [
  {
    _id: "hosp_1",
    name: "Phoenix Hospital",
    location: { lat: 19.0760, lng: 72.8777 },
    capacity: { totalBeds: 500, occupiedBeds: 250, totalICU: 50, occupiedICU: 28 },
    staff: { availableDoctors: 20, availableNurses: 80 },
    departments: { cardiology: 'Available', trauma: 'Limited', neurology: 'Available' },
    reputation: 4.8,
    status: "green"
  },
  {
    _id: "hosp_2",
    name: "Karuna Hospital",
    location: { lat: 19.1136, lng: 72.8697 },
    capacity: { totalBeds: 300, occupiedBeds: 200, totalICU: 30, occupiedICU: 15 },
    staff: { availableDoctors: 15, availableNurses: 50 },
    departments: { cardiology: 'Limited', trauma: 'Available', neurology: 'Available' },
    reputation: 4.5,
    status: "green"
  },
  {
    _id: "hosp_3",
    name: "SRV Hospital Goregaon",
    location: { lat: 19.1646, lng: 72.8493 },
    capacity: { totalBeds: 400, occupiedBeds: 320, totalICU: 40, occupiedICU: 30 },
    staff: { availableDoctors: 25, availableNurses: 60 },
    departments: { cardiology: 'Available', trauma: 'Full', neurology: 'Limited' },
    reputation: 4.7,
    status: "yellow"
  }
];

let ambulances = [
  { _id: "amb_1", vehicleId: "AMB-101", location: { lat: 19.0800, lng: 72.8800 }, status: "en_route", assignedHospital: hospitals[0], eta: 15 },
  { _id: "amb_2", vehicleId: "AMB-102", location: { lat: 19.1000, lng: 72.8600 }, status: "idle", assignedHospital: null, eta: null },
  { _id: "amb_3", vehicleId: "AMB-103", location: { lat: 19.1500, lng: 72.8400 }, status: "en_route", assignedHospital: hospitals[1], eta: 8 }
];

let patients = [
  { _id: "PAT-2026-0001", name: "Krrish Gupta", severity: "emergency", severityScore: 95, status: "waiting", hospital: "hosp_1", estimatedWaitTime: 0, goldenHour: 45 },
  { _id: "PAT-2026-0002", name: "Sneha Gupta", severity: "critical", severityScore: 82, status: "waiting", hospital: "hosp_1", estimatedWaitTime: 5, goldenHour: null },
  { _id: "PAT-2026-0003", name: "Bob Brown", severity: "normal", severityScore: 25, status: "waiting", hospital: "hosp_2", estimatedWaitTime: 45, goldenHour: null },
  { _id: "PAT-2026-0005", name: "Amit singh", severity: "normal", severityScore: 18, status: "waiting", hospital: "hosp_3", estimatedWaitTime: 30, goldenHour: null }
];

let systemMode = 'normal'; // 'normal' or 'disaster'

// Get all hospitals
router.get('/hospitals', (req, res) => {
    res.json(hospitals);
});

// Get hospital by ID
router.get('/hospitals/:id', (req, res) => {
    const hospital = hospitals.find(h => h._id === req.params.id);
    if (hospital) res.json(hospital);
    else res.status(404).json({ error: 'Hospital not found' });
});

// Update hospital capacity (Simulated update)
router.post('/hospitals/:id/capacity', (req, res) => {
    const index = hospitals.findIndex(h => h._id === req.params.id);
    if (index !== -1) {
        hospitals[index].capacity = req.body.capacity;
        
        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
           io.emit('hospital_update', hospitals[index]);
           
           // Alert if critical overload
           const totalCapacity = hospitals[index].capacity.totalBeds + hospitals[index].capacity.totalICU;
           const occupied = hospitals[index].capacity.occupiedBeds + hospitals[index].capacity.occupiedICU;
           if (occupied / totalCapacity > 0.9) {
               io.emit('emergency_alert', { message: `CRITICAL OVERLOAD: ${hospitals[index].name} is near full capacity!`, hospitalId: hospitals[index]._id });
           }
        }
        res.json(hospitals[index]);
    } else {
        res.status(404).json({ error: 'Hospital not found' });
    }
});

// Get active ambulances
router.get('/ambulances', (req, res) => {
    res.json(ambulances);
});

// Get patient queue
router.get('/patients', (req, res) => {
    let waiting = patients.filter(p => p.status === 'waiting');
    // Sort logic will be fully handled by frontend based on severityScore
    res.json(waiting);
});

// Get system mode
router.get('/mode', (req, res) => {
    res.json({ mode: systemMode });
});

// Toggle emergency mode
router.post('/toggle-mode', (req, res) => {
    systemMode = req.body.mode;
    const io = req.app.get('io');
    if (io) {
        io.emit('mode_change', { mode: systemMode });
    }
    res.json({ mode: systemMode });
});

// Simulate emergency surge (+10 Patients variant)
router.post('/simulate-surge', (req, res) => {
    // Randomly increase hospital occupancy
    hospitals.forEach(h => {
        h.capacity.occupiedBeds = Math.min(h.capacity.totalBeds, h.capacity.occupiedBeds + Math.floor(Math.random() * 20));
        h.capacity.occupiedICU = Math.min(h.capacity.totalICU, h.capacity.occupiedICU + Math.floor(Math.random() * 5));
    });

    // Add 10 new severe patients
    for (let i = 0; i < 10; i++) {
        const newId = `PAT-SIM-${Date.now()}-${i}`;
        patients.push({
            _id: newId,
            name: `Surge Patient ${Math.floor(Math.random() * 1000)}`,
            severity: "emergency",
            severityScore: 85 + Math.floor(Math.random() * 15),
            status: "waiting",
            hospital: hospitals[Math.floor(Math.random() * hospitals.length)]._id,
            estimatedWaitTime: 10 + Math.floor(Math.random() * 20),
            goldenHour: 60 - Math.floor(Math.random() * 30)
        });
    }

    const io = req.app.get('io');
    if (io) {
        // Trigger a global refresh
        io.emit('hospital_update', hospitals[0]); 
        io.emit('emergency_alert', { message: "🚨 SIMULATION TRIGGERED: +10 Critical Patients incoming. System recalibrating." });
    }

    res.json({ message: "Surge simulated", hospitals, patients });
});

module.exports = router;
