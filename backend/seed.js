require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');
const Ambulance = require('./models/Ambulance');
const Patient = require('./models/Patient');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hospitalsync';

const seedDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Hospital.deleteMany({});
    await Ambulance.deleteMany({});
    await Patient.deleteMany({});

    // 1. Create Hospitals
    const hospitalsData = [
      {
        name: "City General Hospital",
        location: { lat: 40.7128, lng: -74.0060 },
        capacity: { totalBeds: 500, occupiedBeds: 450, totalICU: 50, occupiedICU: 48 }, // Red status
        staff: { availableDoctors: 20, availableNurses: 80 },
        status: "red"
      },
      {
        name: "Metro Health Center",
        location: { lat: 40.7282, lng: -73.9942 },
        capacity: { totalBeds: 300, occupiedBeds: 200, totalICU: 30, occupiedICU: 15 }, // Green status
        staff: { availableDoctors: 15, availableNurses: 50 },
        status: "green"
      },
      {
        name: "County Medical",
        location: { lat: 40.7589, lng: -73.9851 },
        capacity: { totalBeds: 400, occupiedBeds: 320, totalICU: 40, occupiedICU: 30 }, // Yellow status
        staff: { availableDoctors: 25, availableNurses: 60 },
        status: "yellow"
      }
    ];

    const hospitals = await Hospital.insertMany(hospitalsData);
    console.log('Hospitals seeded');

    // 2. Create Ambulances
    const ambulancesData = [
      {
        vehicleId: "AMB-101",
        location: { lat: 40.7300, lng: -73.9900 },
        status: "en_route",
        assignedHospital: hospitals[0]._id,
        eta: 15
      },
      {
        vehicleId: "AMB-102",
        location: { lat: 40.7500, lng: -73.9800 },
        status: "idle",
        assignedHospital: null,
        eta: null
      },
      {
        vehicleId: "AMB-103",
        location: { lat: 40.7200, lng: -74.0100 },
        status: "en_route",
        assignedHospital: hospitals[1]._id,
        eta: 8
      }
    ];

    await Ambulance.insertMany(ambulancesData);
    console.log('Ambulances seeded');

    // 3. Create Patients
    const patientsData = [
      { name: "John Doe", severity: "emergency", status: "waiting", hospital: hospitals[0]._id, estimatedWaitTime: 0 },
      { name: "Jane Smith", severity: "critical", status: "waiting", hospital: hospitals[0]._id, estimatedWaitTime: 5 },
      { name: "Bob Brown", severity: "normal", status: "waiting", hospital: hospitals[1]._id, estimatedWaitTime: 45 },
      { name: "Alice White", severity: "normal", status: "waiting", hospital: hospitals[2]._id, estimatedWaitTime: 30 }
    ];

    await Patient.insertMany(patientsData);
    console.log('Patients seeded');

    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();
