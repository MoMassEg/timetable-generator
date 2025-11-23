import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    roomID: "",
    type: "lec",
    labType: "",
    capacity: 1,
  });

  const api = axios.create({ baseURL: "http://localhost:5000/api" });

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

  useEffect(() => {
    if (timetableID) {
      fetchRooms();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setRooms([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/rooms/${timetableID}`);
      setRooms(res.data);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setError("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    try {
      const exportData = rooms.map(room => {
        return {
          'Room ID': room.roomID,
          'Type': room.type,
          'Lab Type': room.labType || '',
          'Capacity': room.capacity
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rooms");

      worksheet['!cols'] = [
        { wch: 15 },  
        { wch: 10 },  
        { wch: 20 },  
        { wch: 10 }   
      ];

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `rooms_${timetableID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
      
      setError("");
      alert(`Successfully exported ${rooms.length} rooms to Excel!`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      setError("Failed to export data to Excel");
    }
  };

  const handleImportFromExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        setLoading(true);
        setImportError("");
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          setImportError("No data found in Excel file");
          setLoading(false);
          return;
        }

        console.log(`Importing to timetable: ${timetableID}`);
        console.log(`Found ${jsonData.length} rooms in Excel file`);

        const importedRooms = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            if (!row['Room ID']) {
              errors.push(`Row ${i + 2}: Missing Room ID`);
              continue;
            }

            const type = row['Type']?.toLowerCase().trim();
            if (!['lec', 'lab', 'tut'].includes(type)) {
              errors.push(`Row ${i + 2}: Invalid type "${row['Type']}". Must be lec, lab, or tut`);
              continue;
            }

            const capacity = parseInt(row['Capacity']);
            if (isNaN(capacity) || capacity < 1) {
              errors.push(`Row ${i + 2}: Invalid capacity "${row['Capacity']}". Must be a number >= 1`);
              continue;
            }

            importedRooms.push({
              roomID: String(row['Room ID']).trim(),
              type: type,
              labType: row['Lab Type'] ? String(row['Lab Type']).trim() : '',
              capacity: capacity,
              timetableID
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err.message}`);
          }
        }

        if (errors.length > 0) {
          setImportError(`Import warnings:\n${errors.join('\n')}`);
        }

        console.log(`Valid rooms to import: ${importedRooms.length}`);

        let successCount = 0;
        let failCount = 0;
        let updatedCount = 0;
        let createdCount = 0;
        const failedRooms = [];

        for (const room of importedRooms) {
          try {
            const existingRoom = rooms.find(r => r.roomID === room.roomID);

            if (existingRoom) {
              await api.put(`/rooms/${existingRoom._id}`, room);
              successCount++;
              updatedCount++;
              console.log(`Updated: ${room.roomID}`);
            } else {
              await api.post("/rooms", room);
              successCount++;
              createdCount++;
              console.log(`Created: ${room.roomID}`);
            }
          } catch (err) {
            failCount++;
            const errorMsg = err.response?.data?.error || err.message;
            failedRooms.push(`${room.roomID}: ${errorMsg}`);
            console.error(`Error importing room ${room.roomID}:`, errorMsg);
          }
        }

        await fetchRooms();

        let message = `Import completed!\n✓ ${successCount} rooms imported successfully`;
        if (createdCount > 0) message += `\n  - ${createdCount} new rooms created`;
        if (updatedCount > 0) message += `\n  - ${updatedCount} existing rooms updated`;
        
        if (failCount > 0) {
          message += `\n✗ ${failCount} failed:\n${failedRooms.join('\n')}`;
          setImportError(message);
        } else {
          setError("");
          setImportError("");
          alert(message);
        }

        event.target.value = '';
        
      } catch (err) {
        console.error("Error importing Excel file:", err);
        setImportError("Failed to import Excel file. Please check the file format.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Room ID': 'R101',
        'Type': 'lec',
        'Lab Type': '',
        'Capacity': 50
      },
      {
        'Room ID': 'LAB201',
        'Type': 'lab',
        'Lab Type': 'Computer',
        'Capacity': 30
      },
      {
        'Room ID': 'TUT301',
        'Type': 'tut',
        'Lab Type': '',
        'Capacity': 25
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 10 }
    ];

    const instructions = [
      { 'Field': 'Room ID', 'Description': 'Unique identifier for the room (required)', 'Example': 'R101', 'Valid Values': 'Any text' },
      { 'Field': 'Type', 'Description': 'Type of room (required)', 'Example': 'lec', 'Valid Values': 'lec, lab, tut' },
      { 'Field': 'Lab Type', 'Description': 'Type of lab (optional)', 'Example': 'Computer', 'Valid Values': 'Any text or leave empty' },
      { 'Field': 'Capacity', 'Description': 'Maximum capacity (required)', 'Example': '50', 'Valid Values': 'Number >= 1' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'rooms_template.xlsx');
    
    alert('Template downloaded!\n\nCheck the sheets:\n• Template - Sample data\n• Instructions - Field descriptions and valid values');
  };

  const filteredRooms = rooms.filter((room) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      room.roomID.toLowerCase().includes(searchLower) ||
      room.type.toLowerCase().includes(searchLower) ||
      (room.labType && room.labType.toLowerCase().includes(searchLower)) ||
      room.capacity.toString().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingRoom) {
        await api.put(`/rooms/${editingRoom._id}`, {
          ...formData,
          timetableID,
        });
      } else {
        await api.post("/rooms", {
          ...formData,
          timetableID,
        });
      }
      fetchRooms();
      resetForm();
    } catch (err) {
      console.error("Error saving room:", err);
      setError(err.response?.data?.error || "Failed to save room");
    } finally {
      setLoading(false);
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
      setLoading(true);
      await api.delete(`/rooms/${id}`);
      fetchRooms();
    } catch (err) {
      console.error("Error deleting room:", err);
      setError("Failed to delete room");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingRoom(null);
    setFormData({ roomID: "", type: "lec", labType: "", capacity: 1 });
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage rooms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">Room Management</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button 
            onClick={handleDownloadTemplate}
            className="btn btn-secondary"
            disabled={loading}
            title="Download Excel template with instructions"
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            Template
          </button>
          
          <label 
            className="btn btn-secondary" 
            style={{ 
              marginBottom: 0, 
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", 
              alignItems: "center", 
              gap: "0.25rem",
              opacity: loading ? 0.6 : 1
            }}
          >
            Import
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportFromExcel}
              style={{ display: "none" }}
              disabled={loading}
            />
          </label>
          
          <button 
            onClick={handleExportToExcel}
            className="btn btn-secondary"
            disabled={loading || rooms.length === 0}
            title="Export all rooms to Excel"
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            Export
          </button>
          
          <button 
            onClick={() => setShowModal(true)} 
            className="btn btn-primary"
            disabled={loading}
          >
            Add Room
          </button>
        </div>
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

      {importError && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fef3c7",
            color: "#92400e",
            borderRadius: "4px",
            margin: "1rem",
            whiteSpace: "pre-line",
            fontSize: "0.875rem"
          }}
        >
          {importError}
        </div>
      )}

      <div style={{ padding: "1rem" }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search rooms by ID, type, lab type, or capacity..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: "1rem" }}
          disabled={loading}
        />
        {loading && (
          <div style={{ textAlign: "center", padding: "0.5rem", color: "#6b7280" }}>
            Loading...
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Room ID</th>
              <th>Type</th>
              <th>Lab Type</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.map((room, index) => (
              <tr key={room._id}>
                <td>{index + 1}</td>
                <td>{room.roomID}</td>
                <td>
                  <span className={`badge badge-${room.type === 'lec' ? 'primary' : room.type === 'lab' ? 'warning' : 'info'}`}>
                    {room.type}
                  </span>
                </td>
                <td>{room.labType || "—"}</td>
                <td>{room.capacity}</td>
                <td>
                  <button
                    onClick={() => handleEdit(room)}
                    className="btn btn-sm btn-secondary"
                    style={{ marginRight: "0.5rem" }}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(room._id)}
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

        {filteredRooms.length === 0 && !loading && (
          <div className="empty-state">
            <h3>No rooms found</h3>
            <p>{searchTerm ? "Try a different search term" : "Add your first room to get started"}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingRoom ? "Edit Room" : "Add New Room"}</h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Room ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.roomID}
                  onChange={(e) =>
                    setFormData({ ...formData, roomID: e.target.value })
                  }
                  required
                  disabled={!!editingRoom || loading}
                  placeholder="e.g., R101"
                />
                {editingRoom && (
                  <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                    Room ID cannot be changed
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  disabled={loading}
                >
                  <option value="lec">Lecture (lec)</option>
                  <option value="lab">Lab (lab)</option>
                  <option value="tut">Tutorial (tut)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lab Type (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.labType}
                  onChange={(e) =>
                    setFormData({ ...formData, labType: e.target.value })
                  }
                  disabled={loading}
                  placeholder="e.g., Computer, Physics, Chemistry"
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Specify lab type if Type is 'lab'
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })
                  }
                  min="1"
                  required
                  disabled={loading}
                  placeholder="e.g., 50"
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Maximum number of students the room can accommodate
                </small>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Processing..." : (editingRoom ? "Update Room" : "Create Room")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;