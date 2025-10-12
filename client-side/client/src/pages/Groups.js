import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api/groups";

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [sections, setSections] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    groupID: "",
    yearID: 1,
    sections: [],
  });

  useEffect(() => {
    fetchGroups();
    fetchSections();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(API_URL);
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSections = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/sections");
      setSections(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await axios.put(`${API_URL}/${editingGroup._id}`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      resetForm();
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      groupID: group.groupID,
      yearID: group.yearID,
      sections: group.sections || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this group?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setGroups(groups.filter((g) => g._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ groupID: "", yearID: 1, sections: [] });
    setEditingGroup(null);
    setShowModal(false);
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Group Management</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">Add Group</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Group ID</th>
              <th>Year</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g._id}>
                <td>{g.groupID}</td>
                <td>{g.yearID}</td>
                <td>
                  <button onClick={() => handleEdit(g)} className="btn btn-sm btn-secondary">Edit</button>
                  <button onClick={() => handleDelete(g._id)} className="btn btn-sm btn-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingGroup ? "Edit Group" : "Add Group"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Group ID</label>
                <input type="text" className="input" value={formData.groupID} 
                  onChange={(e) => setFormData({ ...formData, groupID: e.target.value })}
                  required disabled={!!editingGroup}
                />
              </div>

              <div className="form-group">
                <label>Year</label>
                <select className="input" value={formData.yearID} 
                  onChange={(e) => setFormData({ ...formData, yearID: parseInt(e.target.value) })}>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Sections</label>
                <div className="flex flex-col max-h-40 overflow-y-auto border rounded p-2">
                  {sections.map((s) => (
                    <label key={s._id} className="inline-flex items-center mb-1">
                      <input
                        type="checkbox"
                        className="mr-2"
                        value={s.sectionID}
                        checked={formData.sections.includes(s.sectionID)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData((prev) => {
                            if (prev.sections.includes(value)) {
                              return { ...prev, sections: prev.sections.filter((id) => id !== value) };
                            } else {
                              return { ...prev, sections: [...prev.sections, value] };
                            }
                          });
                        }}
                      />
                      {s.sectionID} - {s.sectionName}
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
