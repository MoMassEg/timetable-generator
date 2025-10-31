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
  const [formData, setFormData] = useState({
    taID: "",
    name: "",
    qualifiedCourses: [],
  });

  useEffect(() => {
    fetchTAs();
    fetchCourses();
    fetchInstructors();
  }, []);

  const fetchTAs = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/tas");
      setTAs(res.data);
    } catch (err) {
      console.error("Error fetching TAs:", err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/courses");
      setCourses(res.data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const fetchInstructors = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/instructors");
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
      if (editingTA) {
        await axios.put(`http://localhost:5000/api/tas/${editingTA._id}`, formData);
      } else {
        await axios.post("http://localhost:5000/api/tas", formData);
      }
      fetchTAs();
      resetForm();
    } catch (err) {
      console.error("Error saving TA:", err);
    }
  };

  const handleEdit = (ta) => {
    setEditingTA(ta);
    setFormData({
      taID: ta.taID,
      name: ta.name,
      qualifiedCourses: ta.qualifiedCourses || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this TA?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/tas/${id}`);
      fetchTAs();
    } catch (err) {
      console.error("Error deleting TA:", err);
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

  const resetForm = () => {
    setShowModal(false);
    setEditingTA(null);
    setFormData({ taID: "", name: "", qualifiedCourses: [] });
    setCourseSearchTerm("");
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">TA Management</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Add TA
          </button>
        </div>

        <div style={{ padding: "1rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search TAs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: "1rem" }}
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
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ta._id)}
                      className="btn btn-sm btn-danger"
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
        <div className="modal-overlay">
          <div className="modal">
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
                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingTA ? "Update" : "Create"}
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
