// models/Group.js
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    groupID: { type: String, required: true, unique: true },
    yearID: { type: Number, required: true },
    sections: [{ type: String }],
    timetableID: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
