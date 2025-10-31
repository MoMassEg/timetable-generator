import React, { useState, useEffect } from "react";
import axios from "axios";

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    courseID: "",
    courseName: "",
    type: "lec",
    labType: "",
    duration: 1,
    priority: 0,
    allYear: false,
  });

  useEffect(() => {
    fetchCourses();
    fetchInstructors();
  }, []);

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

  const getAssignedInstructor = (courseID) => {
    const instructor = instructors.find(inst => 
      inst.qualifiedCourses.includes(courseID)
    );
    return instructor ? instructor.name : "Not Assigned";
  };

  const filteredCourses = courses.filter(course => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const assignedInstructor = getAssignedInstructor(course.courseID);
    return (
      course.courseID.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      course.type.toLowerCase().includes(searchLower) ||
      (course.labType && course.labType.toLowerCase().includes(searchLower)) ||
      assignedInstructor.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        await axios.put(
          `http://localhost:5000/api/courses/${editingCourse._id}`,
          formData
        );
      } else {
        await axios.post("http://localhost:5000/api/courses", formData);
      }
      fetchCourses();
      resetForm();
    } catch (err) {
      console.error("Error saving course:", err);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      courseID: course.courseID,
      courseName: course.courseName,
      type: course.type,
      labType: course.labType || "",
      duration: course.duration,
      priority: course.priority || 0,
      allYear: course.allYear || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this course?")) {
      try {
        await axios.delete(`http://localhost:5000/api/courses/${id}`);
        fetchCourses();
      } catch (err) {
        console.error("Error deleting course:", err);
      }
    }
  };

  const resetForm = () => {
    setEditingCourse(null);
    setFormData({ 
      courseID: "", 
      courseName: "", 
      type: "lec", 
      labType: "", 
      duration: 1,
      priority: 0,
      allYear: false,
    });
    setShowModal(false);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Course Management</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Add Course
          </button>
        </div>

        <div style={{ padding: "1rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search courses..."
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
                <th>Type</th>
                <th>Lab Type</th>
                <th>Duration</th>
                <th>Priority</th>
                <th>All Year</th>
                <th>Assigned Instructor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course._id}>
                  <td>{course.courseID}</td>
                  <td>{course.courseName}</td>
                  <td>{course.type}</td>
                  <td>{course.labType}</td>
                  <td>{course.duration}</td>
                  <td>{course.priority || 0}</td>
                  <td>
                    <span className={`badge ${course.allYear ? 'badge-success' : 'badge-secondary'}`}>
                      {course.allYear ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>{getAssignedInstructor(course.courseID)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(course)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(course._id)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCourses.length === 0 && (
            <div className="empty-state">
              <h3>No courses found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first course to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCourse ? "Edit Course" : "Add New Course"}
              </h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Course ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.courseID}
                  onChange={(e) =>
                    setFormData({ ...formData, courseID: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.courseName}
                  onChange={(e) =>
                    setFormData({ ...formData, courseName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="lec">lec</option>
                  <option value="tut">tut</option>
                  <option value="lab">lab</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lab Type</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.labType}
                  onChange={(e) =>
                    setFormData({ ...formData, labType: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: parseInt(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  placeholder="0 (lowest priority)"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.allYear}
                    onChange={(e) =>
                      setFormData({ ...formData, allYear: e.target.checked })
                    }
                    style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                  />
                  All Year Course
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCourse ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
