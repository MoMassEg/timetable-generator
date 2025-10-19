const mongoose = require('mongoose');

const taSchema = new mongoose.Schema({
  taID: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  qualifiedCourses: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('TA', taSchema);
