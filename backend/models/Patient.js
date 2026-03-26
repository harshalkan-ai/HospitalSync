const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  severity: { type: String, enum: ['normal', 'critical', 'emergency'], required: true },
  status: { type: String, enum: ['waiting', 'admitted', 'discharged'], default: 'waiting' },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  estimatedWaitTime: { type: Number, default: 0 } // in minutes
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);
