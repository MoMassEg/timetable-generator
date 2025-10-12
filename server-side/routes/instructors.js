// routes/instructorRoutes.js
const express = require("express");
const Instructor = require("../models/Instructor.js");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const instructors = await Instructor.find();
    res.json(instructors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) return res.status(404).json({ message: "Instructor not found" });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { instructorID, name, qualifiedCourses } = req.body;
    const newInstructor = new Instructor({ instructorID, name, qualifiedCourses });
    await newInstructor.save();
    res.status(201).json(newInstructor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updatedInstructor = await Instructor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedInstructor) return res.status(404).json({ message: "Instructor not found" });
    res.json(updatedInstructor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Instructor.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Instructor not found" });
    res.json({ message: "Instructor deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
