// routes/roomRoutes.js
const express = require("express");
const Room = require("../models/Room.js");
const router = express.Router();

// Get all rooms for a specific timetable
router.get("/:timetableID", async (req, res) => {
  try {
    const rooms = await Room.find({ timetableID: req.params.timetableID });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get room by ID
router.get("/room/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create room
router.post("/", async (req, res) => {
  try {
    const { roomID, type, labType, capacity, timetableID } = req.body;
    
    if (!timetableID) {
      return res.status(400).json({ error: "timetableID is required" });
    }

    const newRoom = new Room({ roomID, type, labType, capacity, timetableID });
    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update room
router.put("/:id", async (req, res) => {
  try {
    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRoom) return res.status(404).json({ message: "Room not found" });
    res.json(updatedRoom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete room
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Room not found" });
    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
