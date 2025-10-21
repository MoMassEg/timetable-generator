import React, { useState, useEffect } from "react";
import axios from "axios";


const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    groupID: "",
    yearID: 1,
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/groups");
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

 
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await axios.put(`http://localhost:5000/api/groups/${editingGroup._id}`, formData);
      } else {
        await axios.post("http://localhost:5000/api/groups", formData);
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
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this group?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/groups/${id}`);
      setGroups(groups.filter((g) => g._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ groupID: "", yearID: 1 });
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
                  {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
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
