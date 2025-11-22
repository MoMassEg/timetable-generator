const mongoose = require('mongoose');

const taSchema = new mongoose.Schema({
  taID: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  qualifiedCourses: [{ type: String }],
  timetableID: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TA', taSchema);
