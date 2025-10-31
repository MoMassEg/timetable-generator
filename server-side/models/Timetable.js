const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  timetableID: { type: String, required: true, unique: true },
  name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
