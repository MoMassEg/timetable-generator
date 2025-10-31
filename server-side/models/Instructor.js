// models/Instructor.js
const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
  instructorID: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  qualifiedCourses: [{ type: String }],
  timetableID: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Instructor', instructorSchema);
