const express = require("express");
const Course = require("../models/Course");
const Instructor = require("../models/Instructor");
const Room = require("../models/Room");
const Group = require("../models/Group");
const Section = require("../models/Section");
const TA = require("../models/TAs");
const router = express.Router();

// GET aggregated data
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });
    const instructors = await Instructor.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });
    const tas = await TA.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });
    const rooms = await Room.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });
    const groups = await Group.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });
    const sections = await Section.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });

    // Rename some fields to match your response (like Section.courses instead of assignedCourses)
    const formattedSections = sections.map((s) => ({
      sectionID: s.sectionID,
      groupID: s.groupID,
      year: s.year,
      studentCount: s.studentCount,
      courses: s.assignedCourses,
    }));

    res.json({
      courses,
      instructors,
      tas,
      rooms,
      groups,
      sections: formattedSections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
