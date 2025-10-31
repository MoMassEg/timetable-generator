import React, { useState, useEffect } from "react";
import axios from "axios";

const Sections = () => {
  const [sections, setSections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    sectionID: "",
    groupID: "",
    year: 1,
    studentCount: 0,
    assignedCourses: [],
  });

  const api = axios.create({ baseURL: "http://localhost:5000/api" });

  useEffect(() => {
    fetchSections();
    fetchGroups();
    fetchCourses();
  }, []);

  const fetchSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await api.get("/groups");
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get("/courses");
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSections = sections.filter(section => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      section.sectionID.toLowerCase().includes(searchLower) ||
      section.groupID.toLowerCase().includes(searchLower) ||
      section.year.toString().includes(searchLower) ||
      section.studentCount.toString().includes(searchLower) ||
      section.assignedCourses.some(course => course.toLowerCase().includes(searchLower))
    );
  });

  const handleSubmit = async (e) => {
    console.log("Form submitted:", formData);
    e.preventDefault();
    try {
      if (editingSection) {
        await api.put(`/sections/${editingSection._id}`, formData);
      } else {
        await api.post("/sections", formData);
      }
      resetForm();
      fetchSections();
    } catch (err) {
      console.error(err);
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
      await api.delete(`/sections/${id}`);
      fetchSections();
    } catch (err) {
      console.error(err);
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

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Section Management</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">Add Section</button>
        </div>

        <div style={{ padding: "1rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search sections..."
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
                  <td>{s.assignedCourses.join(", ")}</td>
                  <td>
                    <button onClick={() => handleEdit(s)} className="btn btn-sm btn-secondary" style={{ marginRight: "0.5rem" }}>Edit</button>
                    <button onClick={() => handleDelete(s._id)} className="btn btn-sm btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredSections.length === 0 && (
            <div className="empty-state">
              <h3>No sections found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first section to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingSection ? "Edit Section" : "Add Section"}</h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Section ID</label>
                <input type="text" className="form-input" value={formData.sectionID} 
                  onChange={(e) => setFormData({ ...formData, sectionID: e.target.value })} required disabled={!!editingSection} />
              </div>

              <div className="form-group">
                <label className="form-label">Group</label>
                <select value={formData.groupID} className="form-select" 
                  onChange={(e) => setFormData({ ...formData, groupID: e.target.value })} required>
                  <option value="">Select Group</option>
                  {groups.map((g) => <option key={g._id} value={g.groupID}>{g.groupID}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <input type="number" className="form-input" value={formData.year} min={1} 
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 1 })} required />
              </div>

              <div className="form-group">
                <label className="form-label">Student Count</label>
                <input type="number" className="form-input" value={formData.studentCount} min={0} 
                  onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })} />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Courses</label>
                <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: "0.375rem", padding: "0.5rem" }}>
                  {courses.map((c) => (
                    <label key={c._id} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
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
                                assignedCourses: prev.assignedCourses.filter((id) => id !== value),
                              };
                            } else {
                              return {
                                ...prev,
                                assignedCourses: [...prev.assignedCourses, value],
                              };
                            }
                          });
                        }}
                      />
                      {c.courseID}
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingSection ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sections;
