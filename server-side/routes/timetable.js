
const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable.js');

router.get('/', async (req, res) => {
  try {
    const timetables = await Timetable.find();
    res.json(timetables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ timetableID: req.params.id });
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.post('/', async (req, res) => {
  const timetable = new Timetable({
    timetableID: req.body.timetableID,
    name: req.body.name
  });

  try {
    const newTimetable = await timetable.save();
    res.status(201).json(newTimetable);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const timetable = await Timetable.findOneAndUpdate(
      { timetableID: req.params.id },
      { name: req.body.name },
      { new: true }
    );
    
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }
    res.json(timetable);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const timetable = await Timetable.findOneAndDelete({ timetableID: req.params.id });
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }
    res.json({ message: 'Timetable deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
