import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Sections = () => {
  const [sections, setSections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    sectionID: "",
    groupID: "",
    year: 1,
    studentCount: 0,
    assignedCourses: [],
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

  const handleExportToExcel = () => {
    try {
      const exportData = sections.map(section => {
        return {
          'Section ID': section.sectionID,
          'Group ID': section.groupID,
          'Year': section.year,
          'Student Count': section.studentCount,
          'Assigned Courses': section.assignedCourses?.join(", ") || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sections");

      worksheet['!cols'] = [
        { wch: 15 },  
        { wch: 15 },  
        { wch: 10 },  
        { wch: 15 },  
        { wch: 50 }   
      ];

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `sections_${timetableID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
      
      setError("");
      alert(`Successfully exported ${sections.length} sections to Excel!`);
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
        console.log(`Found ${jsonData.length} sections in Excel file`);

        const importedSections = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            if (!row['Section ID'] || !row['Group ID']) {
              errors.push(`Row ${i + 2}: Missing Section ID or Group ID`);
              continue;
            }

            const year = parseInt(row['Year']);
            if (isNaN(year) || year < 1 || year > 5) {
              errors.push(`Row ${i + 2}: Invalid year "${row['Year']}". Must be between 1 and 5`);
              continue;
            }

            const studentCount = parseInt(row['Student Count']) || 0;
            if (studentCount < 0) {
              errors.push(`Row ${i + 2}: Invalid student count "${row['Student Count']}". Must be >= 0`);
              continue;
            }

            const assignedCourses = row['Assigned Courses'] 
              ? row['Assigned Courses'].split(',').map(c => c.trim()).filter(c => c)
              : [];

            importedSections.push({
              sectionID: String(row['Section ID']).trim(),
              groupID: String(row['Group ID']).trim(),
              year: year,
              studentCount: studentCount,
              assignedCourses: assignedCourses,
              timetableID
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err.message}`);
          }
        }

        if (errors.length > 0) {
          setImportError(`Import warnings:\n${errors.join('\n')}`);
        }

        console.log(`Valid sections to import: ${importedSections.length}`);

        let successCount = 0;
        let failCount = 0;
        let updatedCount = 0;
        let createdCount = 0;
        const failedSections = [];

        for (const section of importedSections) {
          try {
            const existingSection = sections.find(s => s.sectionID === section.sectionID);

            if (existingSection) {
              await api.put(`/sections/${existingSection._id}`, section);
              successCount++;
              updatedCount++;
              console.log(`Updated: ${section.sectionID}`);
            } else {
              await api.post("/sections", section);
              successCount++;
              createdCount++;
              console.log(`Created: ${section.sectionID}`);
            }
          } catch (err) {
            failCount++;
            const errorMsg = err.response?.data?.error || err.message;
            failedSections.push(`${section.sectionID}: ${errorMsg}`);
            console.error(`Error importing section ${section.sectionID}:`, errorMsg);
          }
        }

        await fetchSections();

        let message = `Import completed!\n✓ ${successCount} sections imported successfully`;
        if (createdCount > 0) message += `\n  - ${createdCount} new sections created`;
        if (updatedCount > 0) message += `\n  - ${updatedCount} existing sections updated`;
        
        if (failCount > 0) {
          message += `\n✗ ${failCount} failed:\n${failedSections.join('\n')}`;
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
        'Section ID': 'SEC1A',
        'Group ID': 'G1',
        'Year': 1,
        'Student Count': 30,
        'Assigned Courses': 'CS101, MATH101, ENG101'
      },
      {
        'Section ID': 'SEC1B',
        'Group ID': 'G1',
        'Year': 1,
        'Student Count': 28,
        'Assigned Courses': 'CS101, MATH101'
      },
      {
        'Section ID': 'SEC2A',
        'Group ID': 'G2',
        'Year': 2,
        'Student Count': 25,
        'Assigned Courses': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 50 }
    ];

    const instructions = [
      { 'Field': 'Section ID', 'Description': 'Unique identifier for the section (required)', 'Example': 'SEC1A', 'Valid Values': 'Any text' },
      { 'Field': 'Group ID', 'Description': 'Group this section belongs to (required)', 'Example': 'G1', 'Valid Values': 'Valid Group ID' },
      { 'Field': 'Year', 'Description': 'Academic year (required)', 'Example': '1', 'Valid Values': '1, 2, 3, 4, or 5' },
      { 'Field': 'Student Count', 'Description': 'Number of students (optional)', 'Example': '30', 'Valid Values': 'Number >= 0 (default: 0)' },
      { 'Field': 'Assigned Courses', 'Description': 'Comma-separated course IDs (optional)', 'Example': 'CS101, MATH101', 'Valid Values': 'Valid course IDs or leave empty' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 30 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'sections_template.xlsx');
    
    alert('Template downloaded!\n\nCheck the sheets:\n• Template - Sample data\n• Instructions - Field descriptions and valid values');
  };

  const filteredSections = sections.filter((section) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      section.sectionID.toLowerCase().includes(searchLower) ||
      section.groupID.toLowerCase().includes(searchLower) ||
      section.year.toString().includes(searchLower) ||
      section.studentCount.toString().includes(searchLower) ||
      section.assignedCourses?.some((course) =>
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
      assignedCourses: section.assignedCourses || [],
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
              disabled={loading || sections.length === 0}
              title="Export all sections to Excel"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              Export
            </button>
            
            <button 
              onClick={() => setShowModal(true)} 
              className="btn btn-primary"
              disabled={loading}
            >
              Add Section
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
            placeholder="Search sections by ID, group, year, or courses..."
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
                <th>Section ID</th>
                <th>Group</th>
                <th>Year</th>
                <th>Students</th>
                <th>Assigned Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((s) => (
                <tr key={s._id}>
                  <td>{s.sectionID}</td>
                  <td>
                    <span className="badge badge-primary">
                      {s.groupID}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      Year {s.year}
                    </span>
                  </td>
                  <td>{s.studentCount}</td>
                  <td>{s.assignedCourses?.join(", ") || "—"}</td>
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

          {filteredSections.length === 0 && !loading && (
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
                  placeholder="e.g., SEC1A"
                />
                {editingSection && (
                  <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                    Section ID cannot be changed
                  </small>
                )}
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
                      {g.groupID} (Year {g.yearID})
                    </option>
                  ))}
                </select>
                {groups.length === 0 && (
                  <small style={{ color: "#ef4444", display: "block", marginTop: "0.25rem" }}>
                    No groups available. Please create groups first.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <select
                  className="form-select"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      year: parseInt(e.target.value),
                    })
                  }
                  required
                  disabled={loading}
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
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
                  placeholder="e.g., 30"
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Total number of students in this section
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Courses</label>
                <div
                  style={{
                    maxHeight: "200px",
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
                        cursor: loading ? "not-allowed" : "pointer"
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
                      <span style={{ flex: 1 }}>
                        {c.courseID} - {c.courseName}
                        <br />
                        <small style={{ color: "#6b7280" }}>
                          Type: {c.type} | Duration: {c.duration}
                        </small>
                      </span>
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
                      No courses found. Please create courses first.
                    </p>
                  )}
                </div>
                {formData.assignedCourses.length > 0 && (
                  <small style={{ color: "#6b7280", marginTop: "0.5rem", display: "block" }}>
                    {formData.assignedCourses.length} course(s) selected
                  </small>
                )}
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
                    ? "Update Section"
                    : "Create Section"}
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