import React, { useState, useEffect } from "react";
import axios from "axios";

const Instructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [formData, setFormData] = useState({
    instructorID: "",
    name: "",
    qualifiedCourses: [],
  });

  useEffect(() => {
    fetchInstructors();
    fetchCourses();
  }, []);

  const fetchInstructors = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/instructors");
      setInstructors(res.data);
    } catch (err) {
      console.error("Error fetching instructors:", err);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingInstructor) {
        await axios.put(
          `http://localhost:5000/api/instructors/${editingInstructor._id}`,
          formData
        );
      } else {
        await axios.post("http://localhost:5000/api/instructors", formData);
      }
      fetchInstructors();
      resetForm();
    } catch (err) {
      console.error("Error saving instructor:", err);
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
      await axios.delete(`http://localhost:5000/api/instructors/${id}`);
      fetchInstructors();
    } catch (err) {
      console.error("Error deleting instructor:", err);
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
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Instructor Management</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Add Instructor
          </button>
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
              {instructors.map((ins) => (
                <tr key={ins._id}>
                  <td>{ins.instructorID}</td>
                  <td>{ins.name}</td>
                  <td>{ins.qualifiedCourses?.join(", ") || "—"}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(ins)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ins._id)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {instructors.length === 0 && (
            <div className="empty-state">
              <h3>No instructors found</h3>
              <p>Add your first instructor to get started</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
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
                <div
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                >
                  {courses.map((course) => (
                    <label
                      key={course.courseID}
                      style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.qualifiedCourses.includes(course.courseID)}
                        onChange={() => handleCourseToggle(course.courseID)}
                        style={{ marginRight: "0.5rem" }}
                      />
                      {course.courseID} ({course.type})
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingInstructor ? "Update" : "Create"}
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
