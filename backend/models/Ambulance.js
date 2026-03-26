const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true, unique: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  status: { type: String, enum: ['idle', 'en_route', 'arrived'], default: 'idle' },
  assignedHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
  eta: { type: Number, default: null } // Estimated time of arrival in minutes
}, { timestamps: true });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
