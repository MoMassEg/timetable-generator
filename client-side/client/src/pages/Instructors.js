// pages/Instructors.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const Instructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    instructorID: "",
    name: "",
    qualifiedCourses: [],
  });

  // Check for timetable changes
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

  // Fetch data when timetableID changes
  useEffect(() => {
    if (timetableID) {
      fetchInstructors();
      fetchCourses();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setInstructors([]);
      setCourses([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`http://localhost:5000/api/instructors/${timetableID}`);
      setInstructors(res.data);
    } catch (err) {
      console.error("Error fetching instructors:", err);
      setError("Failed to load instructors");
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

  const filteredInstructors = instructors.filter(ins => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const matchesID = ins.instructorID.toLowerCase().includes(searchLower);
    const matchesName = ins.name.toLowerCase().includes(searchLower);
    const matchesCourses = ins.qualifiedCourses?.some(courseID => 
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

      if (editingInstructor) {
        await axios.put(
          `http://localhost:5000/api/instructors/${editingInstructor._id}`,
          {
            ...formData,
            timetableID,
          }
        );
      } else {
        await axios.post("http://localhost:5000/api/instructors", {
          ...formData,
          timetableID,
        });
      }
      fetchInstructors();
      resetForm();
    } catch (err) {
      console.error("Error saving instructor:", err);
      setError(err.response?.data?.error || "Failed to save instructor");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ins) => {
    setEditingInstructor(ins);
    setFormData({
      instructorID: ins.instructorID,
      name: ins.name,
      qualifiedCourses: ins.qualifiedCourses || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this instructor?")) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/instructors/${id}`);
      fetchInstructors();
    } catch (err) {
      console.error("Error deleting instructor:", err);
      setError("Failed to delete instructor");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseToggle = (courseID) => {
    setFormData((prev) => ({
      ...prev,
      qualifiedCourses: prev.qualifiedCourses.includes(courseID)
        ? prev.qualifiedCourses.filter((name) => name !== courseID)
        : [...prev.qualifiedCourses, courseID],
    }));
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingInstructor(null);
    setFormData({ instructorID: "", name: "", qualifiedCourses: [] });
    setCourseSearchTerm("");
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage instructors</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Instructor Management</h1>
          <button 
            onClick={() => setShowModal(true)} 
            className="btn btn-primary"
            disabled={loading}
          >
            Add Instructor
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
            placeholder="Search instructors..."
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
              {filteredInstructors.map((ins) => (
                <tr key={ins._id}>
                  <td>{ins.instructorID}</td>
                  <td>{ins.name}</td>
                  <td>{formatQualifiedCourses(ins.qualifiedCourses)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(ins)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ins._id)}
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

          {filteredInstructors.length === 0 && (
            <div className="empty-state">
              <h3>No instructors found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first instructor to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingInstructor ? "Edit Instructor" : "Add New Instructor"}
              </h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Instructor ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.instructorID}
                  onChange={(e) =>
                    setFormData({ ...formData, instructorID: e.target.value })
                  }
                  required
                  disabled={!!editingInstructor || loading}
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
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                >
                  {filteredCourses.map((course) => {
                    const assignedInstructor = getAssignedInstructor(course.courseID);
                    return (
                      <label
                        key={course.courseID}
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
                  {loading ? "Processing..." : (editingInstructor ? "Update" : "Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Instructors;
