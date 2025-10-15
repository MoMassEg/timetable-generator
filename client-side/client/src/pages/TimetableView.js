import React, { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, RefreshCw, User, Users, DoorOpen } from "lucide-react";

const TimetableView = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [slotsMax, setSlotsMax] = useState(0);
  const [error, setError] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [selectedTA, setSelectedTA] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

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
        const sectionsData = scheduleResponse.data.sections || [];
        setSections(sectionsData);
        setSlotsMax(scheduleResponse.data.slotsMax || 40);
        
        const instructors = getUniqueInstructors(sectionsData);
        const tas = getUniqueTAs(sectionsData);
        const rooms = getUniqueRooms(sectionsData);
        
        if (instructors.length > 0) setSelectedInstructor(instructors[0]);
        if (tas.length > 0) setSelectedTA(tas[0]);
        if (rooms.length > 0) setSelectedRoom(rooms[0]);
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

  const getUniqueInstructors = (sectionsData) => {
    const instructors = new Set();
    sectionsData.forEach(section => {
      section.schedule.forEach(session => {
        if (session.type === "Lecture") {
          instructors.add(session.instructorID);
        }
      });
    });
    return Array.from(instructors).sort();
  };

  const getUniqueTAs = (sectionsData) => {
    const tas = new Set();
    sectionsData.forEach(section => {
      section.schedule.forEach(session => {
        if (session.type === "Lab" && session.instructorID.startsWith("TA-")) {
          tas.add(session.instructorID);
        }
      });
    });
    return Array.from(tas).sort();
  };

  const getUniqueRooms = (sectionsData) => {
    const rooms = new Set();
    sectionsData.forEach(section => {
      section.schedule.forEach(session => {
        rooms.add(session.roomID);
      });
    });
    return Array.from(rooms).sort();
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

  const getDayName = (slotIndex) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return days[Math.floor(slotIndex / 8)];
  };

  const renderInstructorTable = () => {
    if (!selectedInstructor) return null;

    const instructorSessions = [];
    sections.forEach(section => {
      section.schedule.forEach(session => {
        if (session.instructorID === selectedInstructor && session.type === "Lecture") {
          instructorSessions.push({
            ...session,
            sectionID: section.sectionID,
            groupID: section.groupID
          });
        }
      });
    });

    return (
      <div className="resource-table-card">
        <div className="resource-header">
          <h3><User size={20} /> Instructor Schedule</h3>
          <select 
            value={selectedInstructor} 
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="resource-dropdown"
          >
            {getUniqueInstructors(sections).map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>
        
        {instructorSessions.length === 0 ? (
          <p className="no-sessions">No lectures scheduled</p>
        ) : (
          <table className="resource-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Section</th>
                <th>Room</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {instructorSessions.sort((a, b) => a.slotIndex - b.slotIndex).map((session, idx) => (
                <tr key={idx}>
                  <td>{getDayName(session.slotIndex)}</td>
                  <td>{getTimeLabel(session.slotIndex % 8)}</td>
                  <td>
                    <div className="table-course-info">
                      <strong>{session.courseID}</strong>
                      <span>{session.courseName}</span>
                    </div>
                  </td>
                  <td>{session.sectionID} ({session.groupID})</td>
                  <td>{session.roomID}</td>
                  <td>{session.duration}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const renderTATable = () => {
    if (!selectedTA) return null;

    const taSessions = [];
    sections.forEach(section => {
      section.schedule.forEach(session => {
        if (session.instructorID === selectedTA && session.type === "Lab") {
          taSessions.push({
            ...session,
            sectionID: section.sectionID,
            groupID: section.groupID
          });
        }
      });
    });

    return (
      <div className="resource-table-card">
        <div className="resource-header">
          <h3><Users size={20} /> TA Schedule</h3>
          <select 
            value={selectedTA} 
            onChange={(e) => setSelectedTA(e.target.value)}
            className="resource-dropdown"
          >
            {getUniqueTAs(sections).map(ta => (
              <option key={ta} value={ta}>{ta}</option>
            ))}
          </select>
        </div>
        
        {taSessions.length === 0 ? (
          <p className="no-sessions">No labs scheduled</p>
        ) : (
          <table className="resource-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Section</th>
                <th>Room</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {taSessions.sort((a, b) => a.slotIndex - b.slotIndex).map((session, idx) => (
                <tr key={idx}>
                  <td>{getDayName(session.slotIndex)}</td>
                  <td>{getTimeLabel(session.slotIndex % 8)}</td>
                  <td>
                    <div className="table-course-info">
                      <strong>{session.courseID}</strong>
                      <span>{session.courseName}</span>
                    </div>
                  </td>
                  <td>{session.sectionID} ({session.groupID})</td>
                  <td>{session.roomID}</td>
                  <td>{session.duration}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const renderRoomTable = () => {
    if (!selectedRoom) return null;

    const roomSessions = [];
    sections.forEach(section => {
      section.schedule.forEach(session => {
        if (session.roomID === selectedRoom) {
          roomSessions.push({
            ...session,
            sectionID: section.sectionID,
            groupID: section.groupID
          });
        }
      });
    });

    return (
      <div className="resource-table-card">
        <div className="resource-header">
          <h3><DoorOpen size={20} /> Room Schedule</h3>
          <select 
            value={selectedRoom} 
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="resource-dropdown"
          >
            {getUniqueRooms(sections).map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        </div>
        
        {roomSessions.length === 0 ? (
          <p className="no-sessions">No sessions scheduled</p>
        ) : (
          <table className="resource-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Type</th>
                <th>Section</th>
                <th>Instructor</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {roomSessions.sort((a, b) => a.slotIndex - b.slotIndex).map((session, idx) => (
                <tr key={idx}>
                  <td>{getDayName(session.slotIndex)}</td>
                  <td>{getTimeLabel(session.slotIndex % 8)}</td>
                  <td>
                    <div className="table-course-info">
                      <strong>{session.courseID}</strong>
                      <span>{session.courseName}</span>
                    </div>
                  </td>
                  <td><span className={`type-badge ${session.type.toLowerCase()}`}>{session.type}</span></td>
                  <td>{session.sectionID} ({session.groupID})</td>
                  <td>{session.instructorID}</td>
                  <td>{session.duration}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const renderTimetable = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const timeSlots = Array.from({ length: 8 }, (_, i) => i);

    const sectionData = sections.map((section) => {
      const sessionMap = {};
      const occupiedSlots = new Set();

      section.schedule.forEach((s) => {
        sessionMap[s.slotIndex] = s;
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
                      {isFirstSlotOfDay && (
                        <td rowSpan={8} className="day-cell">
                          <div className="day-label">{day}</div>
                        </td>
                      )}

                      <td className="time-cell">{getTimeLabel(slot)}</td>

                      {sectionData.map(({ section, sessionMap, occupiedSlots }) => {
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
        <>
          {renderTimetable()}
          
          <div className="resource-tables-section">
            <h2 className="resource-section-title">Resource Schedules</h2>
            <div className="resource-tables-grid">
              {renderInstructorTable()}
              {renderTATable()}
              {renderRoomTable()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TimetableView;
