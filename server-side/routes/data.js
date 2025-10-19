const express = require("express");
const Course = require("../models/Course");
const Instructor = require("../models/Instructor");
const Room = require("../models/Room");
const Group = require("../models/Group");
const Section = require("../models/Section");
const TA = require("../models/TAs");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const courses = await Course.find().sort({ priority: -1 });
    const instructors = await Instructor.find();
    const tas = await TA.find();
    const rooms = await Room.find();
    const groups = await Group.find();
    const sections = await Section.find();

    const coursePriorityMap = {};
    courses.forEach(course => {
      coursePriorityMap[course.courseID] = course.priority || 0;
    });

    const formattedSections = sections.map((s) => {
      const sortedCourses = s.assignedCourses && s.assignedCourses.length > 0
        ? [...s.assignedCourses].sort((courseIDA, courseIDB) => {
            const priorityA = coursePriorityMap[courseIDA] || 0;
            const priorityB = coursePriorityMap[courseIDB] || 0;
            return priorityB - priorityA;
          })
        : [];

      return {
        sectionID: s.sectionID,
        groupID: s.groupID,
        year: s.year,
        studentCount: s.studentCount,
        courses: sortedCourses,
      };
    });

    res.json({
      courses,
      instructors,
      tas,
      rooms,
      groups,
      sections: formattedSections,
    });
  } catch (err) {
    console.error("Error in /api/data:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

module.exports = router;