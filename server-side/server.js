const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const courseRoutes = require('./routes/courses');
const instructorRoutes = require('./routes/instructors');
const roomRoutes = require('./routes/rooms');
const sectionRoutes = require('./routes/sections');
const groupRoutes = require('./routes/groups');
const dataRoutes = require('./routes/data');
const ta = require('./routes/ta');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/csit_timetable', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/courses', courseRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/tas', ta);



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
