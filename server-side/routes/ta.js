const express = require("express");
const TA = require("../models/TAs");
const router = express.Router();

// Get all TAs
router.get("/", async (req, res) => {
  try {
    const tas = await TA.find();
    res.json(tas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get TA by id
router.get("/:id", async (req, res) => {
  try {
    const ta = await TA.findById(req.params.id);
    if (!ta) return res.status(404).json({ message: "TA not found" });
    res.json(ta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create TA
router.post("/", async (req, res) => {
  try {
    const { taID, name, qualifiedCourses } = req.body;
    const newTA = new TA({ taID, name, qualifiedCourses });
    await newTA.save();
    res.status(201).json(newTA);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update TA
router.put("/:id", async (req, res) => {
  try {
    const updatedTA = await TA.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedTA) return res.status(404).json({ message: "TA not found" });
    res.json(updatedTA);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete TA
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await TA.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "TA not found" });
    res.json({ message: "TA deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
