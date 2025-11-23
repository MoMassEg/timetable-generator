const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
  instructorID: { type: String, required: true },
  name: { type: String, required: true },
  qualifiedCourses: [{ type: String }],
  preferredTimeSlots: [{ type: Number }],
  unavailableTimeSlots: [{ type: Number }],
  timetableID: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Instructor', instructorSchema);