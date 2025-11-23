const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomID: { type: String, required: true },
  type: { type: String, enum: ["lec", "tut", "lab"], required: true },
  labType: { type: String },
  capacity: { type: Number, required: true },
  timetableID: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
