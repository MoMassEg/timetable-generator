const express = require("express");
const Section = require("../models/Section.js");
const Group = require("../models/Group");

const router = express.Router();

// Get all sections
router.get("/", async (req, res) => {
  try {
    const sections = await Section.find();
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get section by ID
router.get("/:id", async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json({ message: "Section not found" });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new section
router.post("/", async (req, res) => {
  try {
    const { sectionID, groupID, year, studentCount, assignedCourses } = req.body;
    const newSection = new Section({ sectionID, groupID, year, studentCount, assignedCourses });
    await newSection.save();
    const group = await Group.findOne({ groupID });
    if (!group) {
      await Section.deleteOne({ sectionID });
      return res.status(404).json({ error: "Group not found, section creation reverted." });
    }

    if (!group.sections.includes(sectionID)) {
      group.sections.push(sectionID);
      await group.save();
    }
    res.status(201).json(newSection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update section
router.put("/:id", async (req, res) => {
  try {
    const updated = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Section not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete section
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Section.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Section not found" });
    res.json({ message: "Section deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
