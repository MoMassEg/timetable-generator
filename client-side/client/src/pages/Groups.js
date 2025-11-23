import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    groupID: "",
    yearID: 1,
    sections: [],
  });

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

  const handleExportToExcel = () => {
    try {
      const exportData = groups.map(group => {
        return {
          'Group ID': group.groupID,
          'Year': group.yearID,
          'Sections': group.sections?.join(", ") || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Groups");

      worksheet['!cols'] = [
        { wch: 15 },   
        { wch: 10 },  
        { wch: 30 }  
      ];

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `groups_${timetableID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
      
      setError("");
      alert(`Successfully exported ${groups.length} groups to Excel!`);
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
        console.log(`Found ${jsonData.length} groups in Excel file`);

        const importedGroups = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            if (!row['Group ID']) {
              errors.push(`Row ${i + 2}: Missing Group ID`);
              continue;
            }

            const yearID = parseInt(row['Year']);
            if (isNaN(yearID) || yearID < 1 || yearID > 5) {
              errors.push(`Row ${i + 2}: Invalid year "${row['Year']}". Must be between 1 and 5`);
              continue;
            }

            const sections = row['Sections'] 
              ? row['Sections'].split(',').map(s => s.trim()).filter(s => s)
              : [];

            importedGroups.push({
              groupID: String(row['Group ID']).trim(),
              yearID: yearID,
              sections: sections,
              timetableID
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err.message}`);
          }
        }

        if (errors.length > 0) {
          setImportError(`Import warnings:\n${errors.join('\n')}`);
        }

        console.log(`Valid groups to import: ${importedGroups.length}`);

        let successCount = 0;
        let failCount = 0;
        let updatedCount = 0;
        let createdCount = 0;
        const failedGroups = [];

        for (const group of importedGroups) {
          try {
            const existingGroup = groups.find(g => g.groupID === group.groupID);

            if (existingGroup) {
              await axios.put(`http://localhost:5000/api/groups/${existingGroup._id}`, group);
              successCount++;
              updatedCount++;
              console.log(`Updated: ${group.groupID}`);
            } else {
              await axios.post("http://localhost:5000/api/groups", group);
              successCount++;
              createdCount++;
              console.log(`Created: ${group.groupID}`);
            }
          } catch (err) {
            failCount++;
            const errorMsg = err.response?.data?.error || err.message;
            failedGroups.push(`${group.groupID}: ${errorMsg}`);
            console.error(`Error importing group ${group.groupID}:`, errorMsg);
          }
        }

        await fetchGroups();

        let message = `Import completed!\n✓ ${successCount} groups imported successfully`;
        if (createdCount > 0) message += `\n  - ${createdCount} new groups created`;
        if (updatedCount > 0) message += `\n  - ${updatedCount} existing groups updated`;
        
        if (failCount > 0) {
          message += `\n✗ ${failCount} failed:\n${failedGroups.join('\n')}`;
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
        'Group ID': 'G1',
        'Year': 1,
        'Sections': 'A, B, C'
      },
      {
        'Group ID': 'G2',
        'Year': 2,
        'Sections': 'A, B'
      },
      {
        'Group ID': 'G3',
        'Year': 3,
        'Sections': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 30 }
    ];

    const instructions = [
      { 'Field': 'Group ID', 'Description': 'Unique identifier for the group (required)', 'Example': 'G1', 'Valid Values': 'Any text' },
      { 'Field': 'Year', 'Description': 'Academic year (required)', 'Example': '1', 'Valid Values': '1, 2, 3, 4, or 5' },
      { 'Field': 'Sections', 'Description': 'Comma-separated list of sections', 'Example': 'A, B, C', 'Valid Values': 'Any text or leave empty' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'groups_template.xlsx');
    
    alert('Template downloaded!\n\nCheck the sheets:\n• Template - Sample data\n• Instructions - Field descriptions and valid values');
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.groupID.toLowerCase().includes(searchLower) ||
      group.yearID.toString().includes(searchLower) ||
      group.sections?.some(section => section.toLowerCase().includes(searchLower))
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
      sections: group.sections || [],
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
    setFormData({ groupID: "", yearID: 1, sections: [] });
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
              disabled={loading || groups.length === 0}
              title="Export all groups to Excel"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              Export
            </button>
            
            <button 
              onClick={() => setShowModal(true)} 
              className="btn btn-primary"
              disabled={loading}
            >
              Add Group
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
            placeholder="Search groups by ID, year, or section..."
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
                <th>Group ID</th>
                <th>Year</th>
                <th>Sections</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => (
                <tr key={g._id}>
                  <td>{g.groupID}</td>
                  <td>
                    <span className="badge badge-primary">
                      Year {g.yearID}
                    </span>
                  </td>
                  <td>{g.sections?.join(", ") || "—"}</td>
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

          {filteredGroups.length === 0 && !loading && (
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
                  placeholder="e.g., G1"
                />
                {editingGroup && (
                  <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                    Group ID cannot be changed
                  </small>
                )}
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

              <div className="form-group">
                <label className="form-label">Sections</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.sections?.join(", ") || ""}
                  onChange={(e) => {
                    const sectionsArray = e.target.value 
                      ? e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      : [];
                    setFormData({ ...formData, sections: sectionsArray });
                  }}
                  placeholder="e.g., A, B, C"
                  disabled={loading}
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Enter section names separated by commas
                </small>
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
                  {loading ? "Processing..." : (editingGroup ? "Update Group" : "Create Group")}
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