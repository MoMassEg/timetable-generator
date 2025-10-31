// pages/Sections.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const Sections = () => {
  const [sections, setSections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    sectionID: "",
    groupID: "",
    year: 1,
    studentCount: 0,
    assignedCourses: [],
  });

  const api = axios.create({ baseURL: "http://localhost:5000/api" });

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
      fetchSections();
      fetchGroups();
      fetchCourses();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setSections([]);
      setGroups([]);
      setCourses([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchSections = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/sections/${timetableID}`);
      setSections(res.data);
    } catch (err) {
      console.error("Error fetching sections:", err);
      setError("Failed to load sections");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await api.get(`/groups/${timetableID}`);
      setGroups(res.data);
    } catch (err) {
      console.error("Error fetching groups:", err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get(`/courses/${timetableID}`);
      setCourses(res.data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const filteredSections = sections.filter((section) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      section.sectionID.toLowerCase().includes(searchLower) ||
      section.groupID.toLowerCase().includes(searchLower) ||
      section.year.toString().includes(searchLower) ||
      section.studentCount.toString().includes(searchLower) ||
      section.assignedCourses.some((course) =>
        course.toLowerCase().includes(searchLower)
      )
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingSection) {
        await api.put(`/sections/${editingSection._id}`, {
          ...formData,
          timetableID,
        });
      } else {
        await api.post("/sections", {
          ...formData,
          timetableID,
        });
      }
      resetForm();
      fetchSections();
    } catch (err) {
      console.error("Error saving section:", err);
      setError(err.response?.data?.error || "Failed to save section");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setFormData({
      sectionID: section.sectionID,
      groupID: section.groupID,
      year: section.year,
      studentCount: section.studentCount,
      assignedCourses: section.assignedCourses,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this section?")) return;
    try {
      setLoading(true);
      await api.delete(`/sections/${id}`);
      fetchSections();
    } catch (err) {
      console.error("Error deleting section:", err);
      setError("Failed to delete section");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sectionID: "",
      groupID: "",
      year: 1,
      studentCount: 0,
      assignedCourses: [],
    });
    setEditingSection(null);
    setShowModal(false);
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage sections</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Section Management</h1>
          <button 
            onClick={() => setShowModal(true)} 
            className="btn btn-primary"
            disabled={loading}
          >
            Add Section
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
            placeholder="Search sections..."
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
                <th>Group</th>
                <th>Year</th>
                <th>Students</th>
                <th>Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((s) => (
                <tr key={s._id}>
                  <td>{s.sectionID}</td>
                  <td>{s.groupID}</td>
                  <td>{s.year}</td>
                  <td>{s.studentCount}</td>
                  <td>{s.assignedCourses.join(", ") || "-"}</td>
                  <td>
                    <button 
                      onClick={() => handleEdit(s)} 
                      className="btn btn-sm btn-secondary" 
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(s._id)} 
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

          {filteredSections.length === 0 && (
            <div className="empty-state">
              <h3>No sections found</h3>
              <p>
                {searchTerm
                  ? "Try a different search term"
                  : "Add your first section to get started"}
              </p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSection ? "Edit Section" : "Add Section"}
              </h2>
              <button onClick={resetForm} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Section ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.sectionID}
                  onChange={(e) =>
                    setFormData({ ...formData, sectionID: e.target.value })
                  }
                  required
                  disabled={!!editingSection || loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Group</label>
                <select
                  value={formData.groupID}
                  className="form-select"
                  onChange={(e) =>
                    setFormData({ ...formData, groupID: e.target.value })
                  }
                  required
                  disabled={loading}
                >
                  <option value="">Select Group</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g.groupID}>
                      {g.groupID}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.year}
                  min={1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      year: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Student Count</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.studentCount}
                  min={0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      studentCount: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Courses</label>
                <div
                  style={{
                    maxHeight: "160px",
                    overflowY: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                >
                  {courses.map((c) => (
                    <label
                      key={c._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                        padding: "0.25rem",
                        backgroundColor: formData.assignedCourses.includes(
                          c.courseID
                        )
                          ? "#e0f2fe"
                          : "transparent",
                        borderRadius: "0.25rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ marginRight: "0.5rem" }}
                        value={c.courseID}
                        checked={formData.assignedCourses.includes(c.courseID)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData((prev) => {
                            if (prev.assignedCourses.includes(value)) {
                              return {
                                ...prev,
                                assignedCourses: prev.assignedCourses.filter(
                                  (id) => id !== value
                                ),
                              };
                            } else {
                              return {
                                ...prev,
                                assignedCourses: [
                                  ...prev.assignedCourses,
                                  value,
                                ],
                              };
                            }
                          });
                        }}
                        disabled={loading}
                      />
                      {c.courseID} - {c.courseName}
                    </label>
                  ))}
                  {courses.length === 0 && (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "1rem",
                      }}
                    >
                      No courses found
                    </p>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? "Processing..."
                    : editingSection
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sections;
