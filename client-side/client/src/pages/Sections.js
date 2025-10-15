import React, { useState, useEffect } from "react";
import axios from "axios";

const Sections = () => {
  const [sections, setSections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
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
            {sections.map((s) => (
              <tr key={s._id}>
                <td>{s.sectionID}</td>
                <td>{s.groupID}</td>
                <td>{s.year}</td>
                <td>{s.studentCount}</td>
                <td>{s.assignedCourses.join(", ")}</td>
                <td>
                  <button onClick={() => handleEdit(s)} className="btn btn-sm btn-secondary">Edit</button>
                  <button onClick={() => handleDelete(s._id)} className="btn btn-sm btn-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingSection ? "Edit Section" : "Add Section"}</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Section ID</label>
                <input type="text" className="input" value={formData.sectionID} 
                  onChange={(e) => setFormData({ ...formData, sectionID: e.target.value })} required disabled={!!editingSection} />
              </div>

              <div className="form-group">
                <label>Group</label>
                <select value={formData.groupID} className="input" 
                  onChange={(e) => setFormData({ ...formData, groupID: e.target.value })} required>
                  <option value="">Select Group</option>
                  {groups.map((g) => <option key={g._id} value={g.groupID}>{g.groupID}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Year</label>
                <input type="number" className="input" value={formData.year} min={1} 
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 1 })} required />
              </div>

              <div className="form-group">
                <label>Student Count</label>
                <input type="number" className="input" value={formData.studentCount} min={0} 
                  onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })} />
              </div>

              <div className="form-group">
  <label>Assigned Courses</label>
  <div className="flex flex-col max-h-40 overflow-y-auto border rounded p-2">
    {courses.map((c) => (
      <label key={c._id} className="inline-flex items-center mb-1">
        <input
          type="checkbox"
          className="mr-2"
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
