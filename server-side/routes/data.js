const express = require("express");
const Course = require("../models/Course");
const Instructor = require("../models/Instructor");
const Room = require("../models/Room");
const Group = require("../models/Group");
const Section = require("../models/Section");
const TA = require("../models/TAs");
const router = express.Router();
router.get("/:timetableID", async (req, res) => {
  try {
    const { timetableID } = req.params;
    
    if (!timetableID) {
      return res.status(400).json({ error: "timetableID is required" });
    }

    console.log("Searching for timetableID:", timetableID);

    const allCourses = await Course.find();
    console.log("Total courses in DB:", allCourses.length);
    console.log("Sample courses:", allCourses.slice(0, 2));

    const courses = await Course.find({ timetableID: timetableID }).sort({ priority: -1 });
    console.log("Courses with filter:", courses.length, courses);

    const instructors = await Instructor.find({ timetableID: timetableID });
    const tas = await TA.find({ timetableID: timetableID });
    const rooms = await Room.find({ timetableID: timetableID });
    const groups = await Group.find({ timetableID: timetableID });
    const sections = await Section.find({ timetableID: timetableID });

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
