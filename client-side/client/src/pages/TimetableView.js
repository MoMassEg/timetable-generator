import React, { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, RefreshCw } from "lucide-react";

const TimetableView = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [slotsMax, setSlotsMax] = useState(0);
  const [error, setError] = useState(null);

  const backendDataURL = "http://localhost:5000/api/data";
  const schedulerAPI = "http://127.0.0.1:8080/api/schedule";

  useEffect(() => {
    fetchAndGenerateSchedule();
  }, []);

  const fetchAndGenerateSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch input data
      const dataResponse = await axios.get(backendDataURL);
      if (!dataResponse.data) throw new Error("Invalid data response");

      // Step 2: Send data to C++/Go scheduler API
      const scheduleResponse = await axios.post(schedulerAPI, dataResponse.data);

      if (scheduleResponse.data?.success) {
        setSections(scheduleResponse.data.sections || []);
        setSlotsMax(scheduleResponse.data.slotsMax || 40);
      } else {
        setError("Schedule generation failed");
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.response?.data?.error || "Failed to generate schedule");
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (slotIndex) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return days[Math.floor(slotIndex / 8)];
  };

  const getTimeLabel = (slotIndex) => {
    const hour = 9 + (slotIndex % 8);
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const renderTimetable = (section) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const timeSlots = Array.from({ length: 8 }, (_, i) => i);

    // Build session map
    const sessionMap = {};
    section.schedule.forEach((s) => {
      sessionMap[s.slotIndex] = s;
    });

    return (
      <div key={section.sectionID} className="card">
        <div className="card-header">
          <h2 className="card-title">
            {section.sectionID} - {section.groupID} (Year {section.year})
          </h2>
          <p style={{ color: "#6b7280" }}>Students: {section.studentCount}</p>
        </div>

        <div className="timetable-grid">
          {/* Header Row */}
          <div className="timetable-header">Time</div>
          {days.map((day) => (
            <div key={day} className="timetable-header">
              {day}
            </div>
          ))}

          {/* Rows */}
          {timeSlots.map((slot) => (
            <React.Fragment key={slot}>
              <div className="timetable-time">{getTimeLabel(slot)}</div>
              {days.map((day, dayIndex) => {
                const slotIndex = dayIndex * 8 + slot;
                const session = section.schedule.find(
                  (s) => s.slotIndex === slotIndex
                );

                return (
                  <div
                    key={`${section.sectionID}-${slotIndex}`}
                    className={`timetable-cell ${
                      session ? session.type.toLowerCase() : ""
                    }`}
                  >
                    {session ? (
                      <div className="timetable-session">
                        <strong>{session.courseID}</strong>
                        <div style={{ fontSize: "0.85rem" }}>
                          {session.courseName}
                        </div>
                        <div>{session.instructorID}</div>
                        <div>{session.roomID}</div>
                        <div>{session.type}</div>
                        <small>
                          Duration: {session.duration}h • Slots:{" "}
                          {session.slotRange}
                        </small>
                      </div>
                    ) : (
                      <span style={{ color: "#cbd5e0" }}>—</span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  if (loading)
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: "1rem" }}>Generating timetable...</p>
      </div>
    );

  if (error)
    return (
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">
            <Calendar className="inline-block mr-2" size={24} />
            Timetable Generation Error
          </h1>
          <button onClick={fetchAndGenerateSchedule} className="btn btn-secondary">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
        <div className="empty-state">
          <h3>{error}</h3>
          <p>Try refreshing or check your backend server connections.</p>
        </div>
      </div>
    );

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title">
              <Calendar className="inline-block mr-2" size={24} /> Generated
              Timetable
            </h1>
            <p style={{ color: "#6b7280", margin: 0 }}>
              Slots: {slotsMax} • Sections: {sections.length}
            </p>
          </div>
          <button onClick={fetchAndGenerateSchedule} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="empty-state">
          <h3>No sections found</h3>
          <p>Try generating again.</p>
        </div>
      ) : (
        sections.map(renderTimetable)
      )}
    </div>
  );
};

export default TimetableView;
