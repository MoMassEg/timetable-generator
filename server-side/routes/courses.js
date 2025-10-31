// routes/courseRoutes.js
const express = require("express");
const Course = require("../models/Course.js");
const router = express.Router();

// Get all courses for a specific timetable
router.get("/:timetableID", async (req, res) => {
  try {
    const courses = await Course.find({ timetableID: req.params.timetableID }).sort({ priority: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get course by ID
router.get("/course/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course
router.post("/", async (req, res) => {
  try {
    const { courseID, courseName, type, labType, duration, priority, allYear, timetableID } = req.body;
    
    if (!timetableID) {
      return res.status(400).json({ error: "timetableID is required" });
    }

    const newCourse = new Course({ 
      courseID, 
      courseName, 
      type, 
      labType, 
      duration, 
      priority,
      allYear,
      timetableID
    });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update course
router.put("/:id", async (req, res) => {
  try {
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true } 
    );
    if (!updatedCourse) return res.status(404).json({ message: "Course not found" });
    res.json(updatedCourse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete course
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Course.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
