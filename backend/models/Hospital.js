const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  capacity: {
    totalBeds: { type: Number, default: 0 },
    occupiedBeds: { type: Number, default: 0 },
    totalICU: { type: Number, default: 0 },
    occupiedICU: { type: Number, default: 0 }
  },
  staff: {
    availableDoctors: { type: Number, default: 0 },
    availableNurses: { type: Number, default: 0 }
  },
  status: { type: String, enum: ['green', 'yellow', 'red'], default: 'green' }
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
