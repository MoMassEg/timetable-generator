// pages/Groups.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    groupID: "",
    yearID: 1,
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

  // Fetch groups when timetableID changes
  useEffect(() => {
    if (timetableID) {
      fetchGroups();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setGroups([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`http://localhost:5000/api/groups/${timetableID}`);
      setGroups(res.data);
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.groupID.toLowerCase().includes(searchLower) ||
      group.yearID.toString().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingGroup) {
        await axios.put(`http://localhost:5000/api/groups/${editingGroup._id}`, {
          ...formData,
          timetableID,
        });
      } else {
        await axios.post("http://localhost:5000/api/groups", {
          ...formData,
          timetableID,
        });
      }
      resetForm();
      fetchGroups();
    } catch (err) {
      console.error("Error saving group:", err);
      setError(err.response?.data?.error || "Failed to save group");
    } finally {
      setLoading(false);
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
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/groups/${id}`);
      fetchGroups();
    } catch (err) {
      console.error("Error deleting group:", err);
      setError("Failed to delete group");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ groupID: "", yearID: 1 });
    setEditingGroup(null);
    setShowModal(false);
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage groups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Group Management</h1>
          <button 
            onClick={() => setShowModal(true)} 
            className="btn btn-primary"
            disabled={loading}
          >
            Add Group
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
            placeholder="Search groups..."
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
                <th>Group ID</th>
                <th>Year</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => (
                <tr key={g._id}>
                  <td>{g.groupID}</td>
                  <td>Year {g.yearID}</td>
                  <td>
                    <button 
                      onClick={() => handleEdit(g)} 
                      className="btn btn-sm btn-secondary" 
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(g._id)} 
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

          {filteredGroups.length === 0 && (
            <div className="empty-state">
              <h3>No groups found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first group to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingGroup ? "Edit Group" : "Add Group"}</h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Group ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.groupID}
                  onChange={(e) => setFormData({ ...formData, groupID: e.target.value })}
                  required 
                  disabled={!!editingGroup || loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <select 
                  className="form-select" 
                  value={formData.yearID}
                  onChange={(e) => setFormData({ ...formData, yearID: parseInt(e.target.value) })}
                  disabled={loading}
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
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
                  {loading ? "Processing..." : (editingGroup ? "Update" : "Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
