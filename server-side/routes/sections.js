const express = require("express");
const Section = require("../models/Section.js");
const Group = require("../models/Group");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const sections = await Section.find();
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json({ message: "Section not found" });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.put("/:id", async (req, res) => {
  try {
    const currentSection = await Section.findById(req.params.id);
    if (!currentSection) return res.status(404).json({ message: "Section not found" });

    const { groupID } = req.body;
    
    if (groupID && groupID !== currentSection.groupID) {
      const oldGroup = await Group.findOne({ groupID: currentSection.groupID });
      if (oldGroup) {
        oldGroup.sections = oldGroup.sections.filter(id => id !== currentSection.sectionID);
        await oldGroup.save();
      }

      const newGroup = await Group.findOne({ groupID });
      if (!newGroup) {
        return res.status(404).json({ error: "New group not found" });
      }
      
      if (!newGroup.sections.includes(currentSection.sectionID)) {
        newGroup.sections.push(currentSection.sectionID);
        await newGroup.save();
      }
    }

    const updated = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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
