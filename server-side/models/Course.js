const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseID: { type: String, required: true, unique: true },
  courseName: { type: String, required: true },
  type: { type: String, enum: ["lec", "tut", "lab"], required: true },
  labType: { type: String},
  duration: { type: Number, required: true },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
