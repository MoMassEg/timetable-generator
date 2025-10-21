import React, { useState, useEffect } from "react";
import axios from "axios";

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    roomID: "",
    type: "lec",
    labType: "",
    capacity: 1,
  });

  const api = axios.create({ baseURL: "http://localhost:5000/api" });

  const fetchRooms = async () => {
    try {
      const res = await api.get("/rooms");
      setRooms(res.data);
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom._id}`, formData);
      } else {
        await api.post("/rooms", formData);
      }
      fetchRooms();
      resetForm();
    } catch (err) {
      console.error("Error saving room:", err);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      roomID: room.roomID,
      type: room.type,
      labType: room.labType || "",
      capacity: room.capacity,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this room?")) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchRooms();
    } catch (err) {
      console.error("Error deleting room:", err);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingRoom(null);
    setFormData({ roomID: "", type: "lec",labType: "", capacity: 1 });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">
          Room Management
        </h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          Add Room
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Room ID</th>
              <th>Type</th>
              <th>labType</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, index) => (
              <tr key={room._id}>
                <td>{index + 1}</td>
                <td>{room.roomID}</td>
                <td>{room.type}</td>
                <td>{room.labType}</td>
                <td>{room.capacity}</td>
                <td>
                  <button
                    onClick={() => handleEdit(room)}
                    className="btn btn-sm btn-secondary"
                    style={{ marginRight: "0.5rem" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(room._id)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rooms.length === 0 && (
          <div className="empty-state">
            <h3>No rooms found</h3>
            <p>Add your first room to get started</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingRoom ? "Edit Room" : "Add New Room"}</h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Room ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.roomID}
                  onChange={(e) =>
                    setFormData({ ...formData, roomID: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Type</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                >
                  <option value="lec">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tut">Tutorial</option>
                </select>
              </div>
              <div className="form-group">
                <label>lab Type</label>
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
                <label>Capacity</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })
                  }
                  min="1"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingRoom ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
