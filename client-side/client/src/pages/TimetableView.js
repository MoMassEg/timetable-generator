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
      const dataResponse = await axios.get(backendDataURL);
      if (!dataResponse.data) throw new Error("Invalid data response");

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

  const getTimeLabel = (slotIndex) => {
    const times = [
      "9:00 - 9:45",
      "9:45 - 10:30",
      "10:45 - 11:30",
      "11:30 - 12:15",
      "12:30 - 1:15",
      "1:15 - 2:00",
      "2:15 - 3:00",
      "3:00 - 3:45"
    ];
    return times[slotIndex % 8] || `Slot ${slotIndex}`;
  };

  const renderTimetable = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const timeSlots = Array.from({ length: 8 }, (_, i) => i);

    // Build session maps for all sections
    const sectionData = sections.map((section) => {
      const sessionMap = {};
      const occupiedSlots = new Set();

      section.schedule.forEach((s) => {
        sessionMap[s.slotIndex] = s;
        // Mark slots occupied by multi-hour sessions
        for (let i = 1; i < s.duration; i++) {
          occupiedSlots.add(s.slotIndex + i);
        }
      });

      return {
        section,
        sessionMap,
        occupiedSlots
      };
    });

    return (
      <div className="timetable-container">
        <table className="timetable-table">
          <thead>
            <tr>
              <th className="day-time-header" colSpan="2">
                Section
              </th>
              {sections.map((section) => (
                <th key={section.sectionID} className="section-header">
                  <div className="section-info">
                    <div className="section-id">{section.sectionID}</div>
                    <div className="section-details">
                      {section.groupID} - Year {section.year}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, dayIndex) => (
              <React.Fragment key={day}>
                {timeSlots.map((slot, slotIdx) => {
                  const slotIndex = dayIndex * 8 + slot;
                  const isFirstSlotOfDay = slotIdx === 0;

                  return (
                    <tr key={`${day}-${slot}`}>
                      {/* Day cell with rowspan */}
                      {isFirstSlotOfDay && (
                        <td rowSpan={8} className="day-cell">
                          <div className="day-label">{day}</div>
                        </td>
                      )}

                      {/* Time cell */}
                      <td className="time-cell">{getTimeLabel(slot)}</td>

                      {/* Section cells */}
                      {sectionData.map(({ section, sessionMap, occupiedSlots }) => {
                        // Skip if this slot is occupied by a previous multi-hour session
                        if (occupiedSlots.has(slotIndex)) {
                          return null;
                        }

                        const session = sessionMap[slotIndex];

                        if (session) {
                          return (
                            <td
                              key={`${section.sectionID}-${slotIndex}`}
                              rowSpan={session.duration}
                              className={`session-cell ${session.type.toLowerCase()}`}
                            >
                              <div className="session-content">
                                <div className="course-code">{session.courseID}</div>
                                <div className="course-name">{session.courseName}</div>
                                <div className="instructor">{session.instructorID}</div>
                                <div className="room">{session.roomID}</div>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`${section.sectionID}-${slotIndex}`}
                            className="empty-cell"
                          >
                            
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading)
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Generating timetable...</p>
      </div>
    );

  if (error)
    return (
      <div className="error-container">
        <div className="error-header">
          <h1>
            <Calendar size={24} /> Timetable Generation Error
          </h1>
          <button onClick={fetchAndGenerateSchedule} className="btn-refresh">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
        <div className="error-message">
          <h3>{error}</h3>
          <p>Try refreshing or check your backend server connections.</p>
        </div>
      </div>
    );

  return (
    <div className="timetable-wrapper">
      <div className="header-card">
        <div>
          <h1>
            <Calendar size={24} /> Generated Timetable
          </h1>
          <p>
            Slots: {slotsMax} • Sections: {sections.length}
          </p>
        </div>
        <button onClick={fetchAndGenerateSchedule} className="btn-refresh">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="empty-state">
          <h3>No sections found</h3>
          <p>Try generating again.</p>
        </div>
      ) : (
        renderTimetable()
      )}
    </div>
  );
};

export default TimetableView;