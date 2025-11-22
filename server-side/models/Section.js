const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  sectionID: { type: String, required: true, unique: true },
  groupID: { type: String, required: true },
  year: { type: Number, required: true },
  studentCount: { type: Number, default: 0 },
  assignedCourses: { type: [String], default: [] },
  timetableID: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Section', sectionSchema);
