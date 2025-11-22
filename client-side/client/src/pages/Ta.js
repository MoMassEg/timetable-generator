import React, { useState, useEffect } from "react";
import axios from "axios";

const TAs = () => {
  const [tas, setTAs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTA, setEditingTA] = useState(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    taID: "",
    name: "",
    qualifiedCourses: [],
    preferredTimeSlots: [],
    unavailableTimeSlots: [],
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
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

  useEffect(() => {
    const handleStorageChange = () => {
      const newTimetableID = localStorage.getItem("selectedTimetableID");
      setTimetableID(newTimetableID || "");
    };

    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (timetableID) {
      fetchTAs();
      fetchCourses();
      fetchInstructors();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setTAs([]);
      setCourses([]);
      setInstructors([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchTAs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`http://localhost:5000/api/tas/${timetableID}`);
      setTAs(res.data);
    } catch (err) {
      console.error("Error fetching TAs:", err);
      setError("Failed to load TAs");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/courses/${timetableID}`);
      setCourses(res.data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const fetchInstructors = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/instructors/${timetableID}`);
      setInstructors(res.data);
    } catch (err) {
      console.error("Error fetching instructors:", err);
    }
  };

  const getCourseName = (courseID) => {
    const course = courses.find(c => c.courseID === courseID);
    return course ? course.courseName : courseID;
  };

  const getAssignedInstructor = (courseID) => {
    const instructor = instructors.find(inst => 
      inst.qualifiedCourses && inst.qualifiedCourses.includes(courseID)
    );
    return instructor ? instructor.name : "Not Assigned";
  };

  const formatQualifiedCourses = (qualifiedCourses) => {
    if (!qualifiedCourses || qualifiedCourses.length === 0) return "—";
    return qualifiedCourses.map(courseID => {
      const courseName = getCourseName(courseID);
      return `${courseID} - ${courseName}`;
    }).join(", ");
  };

  const filteredTAs = tas.filter(ta => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const matchesID = ta.taID.toLowerCase().includes(searchLower);
    const matchesName = ta.name.toLowerCase().includes(searchLower);
    const matchesCourses = ta.qualifiedCourses?.some(courseID => 
      courseID.toLowerCase().includes(searchLower) || 
      getCourseName(courseID).toLowerCase().includes(searchLower)
    );
    return matchesID || matchesName || matchesCourses;
  });

  const filteredCourses = courses.filter(course => {
    if (!courseSearchTerm) return true;
    const searchLower = courseSearchTerm.toLowerCase();
    return (
      course.courseID.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      course.type.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingTA) {
        await axios.put(`http://localhost:5000/api/tas/${editingTA._id}`, {
          ...formData,
          timetableID,
        });
      } else {
        await axios.post("http://localhost:5000/api/tas", {
          ...formData,
          timetableID,
        });
      }
      fetchTAs();
      resetForm();
    } catch (err) {
      console.error("Error saving TA:", err);
      setError(err.response?.data?.error || "Failed to save TA");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ta) => {
    setEditingTA(ta);
    setFormData({
      taID: ta.taID,
      name: ta.name,
      qualifiedCourses: ta.qualifiedCourses || [],
      preferredTimeSlots: ta.preferredTimeSlots || [],
      unavailableTimeSlots: ta.unavailableTimeSlots || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this TA?")) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/tas/${id}`);
      fetchTAs();
    } catch (err) {
      console.error("Error deleting TA:", err);
      setError("Failed to delete TA");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseToggle = (courseId) => {
    setFormData((prev) => ({
      ...prev,
      qualifiedCourses: prev.qualifiedCourses.includes(courseId)
        ? prev.qualifiedCourses.filter((id) => id !== courseId)
        : [...prev.qualifiedCourses, courseId],
    }));
  };

  const handleTimeSlotToggle = (slotIndex, type) => {
    setFormData((prev) => {
      const currentSlots = prev[type];
      const otherType = type === 'preferredTimeSlots' ? 'unavailableTimeSlots' : 'preferredTimeSlots';
      const otherSlots = prev[otherType];

      if (currentSlots.includes(slotIndex)) {
        return {
          ...prev,
          [type]: currentSlots.filter(slot => slot !== slotIndex)
        };
      } else {
        return {
          ...prev,
          [type]: [...currentSlots, slotIndex],
          [otherType]: otherSlots.filter(slot => slot !== slotIndex)
        };
      }
    });
  };

  const getSlotStatus = (slotIndex) => {
    if (formData.preferredTimeSlots.includes(slotIndex)) return 'preferred';
    if (formData.unavailableTimeSlots.includes(slotIndex)) return 'unavailable';
    return 'available';
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingTA(null);
    setFormData({ 
      taID: "", 
      name: "", 
      qualifiedCourses: [],
      preferredTimeSlots: [],
      unavailableTimeSlots: []
    });
    setCourseSearchTerm("");
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage TAs</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">TA Management</h1>
          <button 
            onClick={() => setShowModal(true)} 
            className="btn btn-primary"
            disabled={loading}
          >
            Add TA
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fee",
              color: "#c00",
              borderRadius: "4px",
              margin: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ padding: "1rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search TAs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: "1rem" }}
            disabled={loading}
          />
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Qualified Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTAs.map((ta) => (
                <tr key={ta._id}>
                  <td>{ta.taID}</td>
                  <td>{ta.name}</td>
                  <td>{formatQualifiedCourses(ta.qualifiedCourses)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(ta)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ta._id)}
                      className="btn btn-sm btn-danger"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTAs.length === 0 && (
            <div className="empty-state">
              <h3>No TAs found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first TA to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "90%" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTA ? "Edit TA" : "Add New TA"}
              </h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">TA ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.taID}
                  onChange={(e) =>
                    setFormData({ ...formData, taID: e.target.value })
                  }
                  required
                  disabled={!!editingTA || loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualified Courses</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search courses..."
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                  style={{ marginBottom: "0.5rem" }}
                  disabled={loading}
                />
                <div style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "0.375rem", 
                  padding: "0.5rem" 
                }}>
                  {filteredCourses.map((course) => {
                    const assignedInstructor = getAssignedInstructor(course.courseID);
                    return (
                      <label 
                        key={course._id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          marginBottom: "0.5rem",
                          padding: "0.25rem",
                          backgroundColor: formData.qualifiedCourses.includes(course.courseID) ? "#e0f2fe" : "transparent",
                          borderRadius: "0.25rem"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.qualifiedCourses.includes(course.courseID)}
                          onChange={() => handleCourseToggle(course.courseID)}
                          style={{ marginRight: "0.5rem" }}
                          disabled={loading}
                        />
                        <span style={{ flex: 1 }}>
                          {course.courseID} - {course.courseName} ({course.type})
                          <br />
                          <small style={{ color: "#6b7280" }}>Assigned: {assignedInstructor}</small>
                        </span>
                      </label>
                    );
                  })}
                  {filteredCourses.length === 0 && (
                    <p style={{ textAlign: "center", color: "#6b7280", padding: "1rem" }}>
                      No courses found
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Time Preferences</label>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#10b981", borderRadius: "4px" }}></div>
                      <span>Preferred</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#ef4444", borderRadius: "4px" }}></div>
                      <span>Unavailable</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px" }}></div>
                      <span>Available</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb" }}>Time</th>
                        {days.map(day => (
                          <th key={day} style={{ padding: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", minWidth: "80px" }}>
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((time, timeIndex) => (
                        <tr key={time}>
                          <td style={{ padding: "0.5rem", border: "1px solid #d1d5db", fontWeight: "500", fontSize: "0.875rem" }}>
                            {time}
                          </td>
                          {days.map((day, dayIndex) => {
                            const slotIndex = dayIndex * 8 + timeIndex;
                            const status = getSlotStatus(slotIndex);
                            return (
                              <td key={`${day}-${timeIndex}`} style={{ padding: "0.25rem", border: "1px solid #d1d5db" }}>
                                <div style={{ display: "flex", gap: "0.25rem" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotToggle(slotIndex, 'preferredTimeSlots')}
                                    disabled={loading || status === 'unavailable'}
                                    style={{
                                      width: "100%",
                                      height: "30px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "4px",
                                      backgroundColor: status === 'preferred' ? "#10b981" : "#f3f4f6",
                                      cursor: status === 'unavailable' ? "not-allowed" : "pointer",
                                      fontSize: "0.75rem"
                                    }}
                                    title="Click to set as preferred"
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotToggle(slotIndex, 'unavailableTimeSlots')}
                                    disabled={loading || status === 'preferred'}
                                    style={{
                                      width: "100%",
                                      height: "30px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "4px",
                                      backgroundColor: status === 'unavailable' ? "#ef4444" : "#f3f4f6",
                                      cursor: status === 'preferred' ? "not-allowed" : "pointer",
                                      fontSize: "0.75rem"
                                    }}
                                    title="Click to set as unavailable"
                                  >
                                    U
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Processing..." : (editingTA ? "Update" : "Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TAs;