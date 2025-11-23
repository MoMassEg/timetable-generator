import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Instructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [importError, setImportError] = useState("");
  const [formData, setFormData] = useState({
    instructorID: "",
    name: "",
    qualifiedCourses: [],
    preferredTimeSlots: [],
    unavailableTimeSlots: [],
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  const times = [
    "9:00 - 9:45",
    "9:45 - 10:30",
    "10:45 - 11:30",
    "11:30 - 12:15",
    "12:30 - 1:15",
    "1:15 - 2:00",
    "2:15 - 3:00",
    "3:00 - 3:45"
  ];

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
      fetchInstructors();
      fetchCourses();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setInstructors([]);
      setCourses([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`http://localhost:5000/api/instructors/${timetableID}`);
      setInstructors(res.data);
    } catch (err) {
      console.error("Error fetching instructors:", err);
      setError("Failed to load instructors");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/courses/${timetableID}`);
      setCourses(res.data);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  const getCourseName = (courseID) => {
    const course = courses.find(c => c.courseID === courseID);
    return course ? course.courseName : courseID;
  };

  const getAssignedInstructor = (courseID) => {
    const instructor = instructors.find(inst => 
      inst.qualifiedCourses && inst.qualifiedCourses.includes(courseID)
    );
    return instructor ? instructor.name : "Not Assigned";
  };

  const formatQualifiedCourses = (qualifiedCourses) => {
    if (!qualifiedCourses || qualifiedCourses.length === 0) return "—";
    return qualifiedCourses.map(courseID => {
      const courseName = getCourseName(courseID);
      return `${courseID} - ${courseName}`;
    }).join(", ");
  };

  const handleExportToExcel = () => {
    try {
      const exportData = instructors.map(instructor => {
        const preferredSlots = instructor.preferredTimeSlots?.sort((a, b) => a - b).join(", ") || "";
        const unavailableSlots = instructor.unavailableTimeSlots?.sort((a, b) => a - b).join(", ") || "";

        return {
          'Instructor ID': instructor.instructorID,
          'Name': instructor.name,
          'Qualified Courses': instructor.qualifiedCourses?.join(", ") || "",
          'Preferred Time Slots': preferredSlots,
          'Unavailable Time Slots': unavailableSlots
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Instructors");

      worksheet['!cols'] = [
        { wch: 15 }, 
        { wch: 25 }, 
        { wch: 40 }, 
        { wch: 30 }, 
        { wch: 30 }  
      ];

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `instructors_${timetableID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
      
      setError("");
      alert(`Successfully exported ${instructors.length} instructors to Excel!`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      setError("Failed to export data to Excel");
    }
  };

  const parseTimeSlots = (slotsString) => {
    if (!slotsString || slotsString.trim() === "") return [];
    
    const slots = [];
    const slotArray = slotsString.split(',').map(s => s.trim()).filter(s => s);
    
    for (const slot of slotArray) {
      const slotIndex = parseInt(slot, 10);
      if (!isNaN(slotIndex) && slotIndex >= 0 && slotIndex <= 39) {
        slots.push(slotIndex);
      }
    }
    
    return slots;
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

        const importedInstructors = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            if (!row['Instructor ID'] || !row['Name']) {
              errors.push(`Row ${i + 2}: Missing Instructor ID or Name`);
              continue;
            }

            const qualifiedCourses = row['Qualified Courses'] 
              ? row['Qualified Courses'].split(',').map(c => c.trim()).filter(c => c)
              : [];

            const preferredTimeSlots = parseTimeSlots(row['Preferred Time Slots']);
            const unavailableTimeSlots = parseTimeSlots(row['Unavailable Time Slots']);

            const overlapping = preferredTimeSlots.filter(slot => 
              unavailableTimeSlots.includes(slot)
            );
            if (overlapping.length > 0) {
              errors.push(`Row ${i + 2}: Overlapping time slots found: ${overlapping.join(', ')}`);
            }

            importedInstructors.push({
              instructorID: String(row['Instructor ID']).trim(),
              name: String(row['Name']).trim(),
              qualifiedCourses,
              preferredTimeSlots,
              unavailableTimeSlots,
              timetableID
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err.message}`);
          }
        }

        if (errors.length > 0) {
          setImportError(`Import warnings:\n${errors.join('\n')}`);
        }

        let successCount = 0;
        let failCount = 0;
        const failedInstructors = [];

        for (const instructor of importedInstructors) {
          try {
            const existingInstructor = instructors.find(
              ins => ins.instructorID === instructor.instructorID
            );

            if (existingInstructor) {
              await axios.put(
                `http://localhost:5000/api/instructors/${existingInstructor._id}`,
                instructor
              );
            } else {
              await axios.post("http://localhost:5000/api/instructors", instructor);
            }
            successCount++;
          } catch (err) {
            failCount++;
            failedInstructors.push(`${instructor.instructorID}: ${err.response?.data?.error || err.message}`);
            console.error(`Error importing instructor ${instructor.instructorID}:`, err);
          }
        }

        await fetchInstructors();

        let message = `Import completed!\n✓ ${successCount} instructors imported successfully`;
        if (failCount > 0) {
          message += `\n✗ ${failCount} failed:\n${failedInstructors.join('\n')}`;
          setImportError(message);
        } else {
          setError("");
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
        'Instructor ID': 'INS001',
        'Name': 'John Doe',
        'Qualified Courses': 'CS101, CS102, MATH201',
        'Preferred Time Slots': '0, 1, 8, 16',
        'Unavailable Time Slots': '20, 28'
      },
      {
        'Instructor ID': 'INS002',
        'Name': 'Jane Smith',
        'Qualified Courses': 'MATH101, PHYS101',
        'Preferred Time Slots': '10, 18, 26',
        'Unavailable Time Slots': '5'
      },
      {
        'Instructor ID': 'INS003',
        'Name': 'Bob Johnson',
        'Qualified Courses': 'ENG101',
        'Preferred Time Slots': '',
        'Unavailable Time Slots': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 40 },
      { wch: 30 },
      { wch: 30 }
    ];

    const instructions = [
      { 'Field': 'Instructor ID', 'Description': 'Unique identifier for the instructor (required)', 'Example': 'INS001' },
      { 'Field': 'Name', 'Description': 'Full name of the instructor (required)', 'Example': 'John Doe' },
      { 'Field': 'Qualified Courses', 'Description': 'Comma-separated list of course IDs', 'Example': 'CS101, MATH201' },
      { 'Field': 'Preferred Time Slots', 'Description': 'Comma-separated slot indices (0-39)', 'Example': '0, 1, 8, 16' },
      { 'Field': 'Unavailable Time Slots', 'Description': 'Comma-separated slot indices (0-39)', 'Example': '20, 28' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 30 }];

    const timeSlotReference = [];
    let slotIndex = 0;
    
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
        timeSlotReference.push({
          'Index': slotIndex,
          'Day': days[dayIndex],
          'Time': times[timeIndex]
        });
        slotIndex++;
      }
    }
    
    const referenceSheet = XLSX.utils.json_to_sheet(timeSlotReference);
    XLSX.utils.book_append_sheet(workbook, referenceSheet, "Time Slot Reference");
    referenceSheet['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'instructors_template.xlsx');
    
    alert('Template downloaded!\n\nCheck the sheets:\n• Template - Sample data\n• Instructions - Field descriptions\n• Time Slot Reference - Index to day/time mapping');
  };

  const filteredInstructors = instructors.filter(ins => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const matchesID = ins.instructorID.toLowerCase().includes(searchLower);
    const matchesName = ins.name.toLowerCase().includes(searchLower);
    const matchesCourses = ins.qualifiedCourses?.some(courseID => 
      courseID.toLowerCase().includes(searchLower) || 
      getCourseName(courseID).toLowerCase().includes(searchLower)
    );
    return matchesID || matchesName || matchesCourses;
  });

  const filteredCourses = courses.filter(course => {
    if (!courseSearchTerm) return true;
    const searchLower = courseSearchTerm.toLowerCase();
    return (
      course.courseID.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      course.type.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingInstructor) {
        await axios.put(
          `http://localhost:5000/api/instructors/${editingInstructor._id}`,
          {
            ...formData,
            timetableID,
          }
        );
      } else {
        await axios.post("http://localhost:5000/api/instructors", {
          ...formData,
          timetableID,
        });
      }
      fetchInstructors();
      resetForm();
    } catch (err) {
      console.error("Error saving instructor:", err);
      setError(err.response?.data?.error || "Failed to save instructor");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ins) => {
    setEditingInstructor(ins);
    setFormData({
      instructorID: ins.instructorID,
      name: ins.name,
      qualifiedCourses: ins.qualifiedCourses || [],
      preferredTimeSlots: ins.preferredTimeSlots || [],
      unavailableTimeSlots: ins.unavailableTimeSlots || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this instructor?")) return;
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/instructors/${id}`);
      fetchInstructors();
    } catch (err) {
      console.error("Error deleting instructor:", err);
      setError("Failed to delete instructor");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseToggle = (courseID) => {
    setFormData((prev) => ({
      ...prev,
      qualifiedCourses: prev.qualifiedCourses.includes(courseID)
        ? prev.qualifiedCourses.filter((name) => name !== courseID)
        : [...prev.qualifiedCourses, courseID],
    }));
  };

  const handleTimeSlotToggle = (slotIndex, type) => {
    setFormData((prev) => {
      const currentSlots = prev[type];
      const otherType = type === 'preferredTimeSlots' ? 'unavailableTimeSlots' : 'preferredTimeSlots';
      const otherSlots = prev[otherType];

      if (currentSlots.includes(slotIndex)) {
        return {
          ...prev,
          [type]: currentSlots.filter(slot => slot !== slotIndex)
        };
      } else {
        return {
          ...prev,
          [type]: [...currentSlots, slotIndex],
          [otherType]: otherSlots.filter(slot => slot !== slotIndex)
        };
      }
    });
  };

  const getSlotStatus = (slotIndex) => {
    if (formData.preferredTimeSlots.includes(slotIndex)) return 'preferred';
    if (formData.unavailableTimeSlots.includes(slotIndex)) return 'unavailable';
    return 'available';
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingInstructor(null);
    setFormData({ 
      instructorID: "", 
      name: "", 
      qualifiedCourses: [],
      preferredTimeSlots: [],
      unavailableTimeSlots: []
    });
    setCourseSearchTerm("");
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage instructors</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Instructor Management</h1>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button 
              onClick={handleDownloadTemplate}
              className="btn btn-secondary"
              disabled={loading}
              title="Download Excel template with time slot reference"
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
              disabled={loading || instructors.length === 0}
              title="Export all instructors to Excel"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              Export
            </button>
            
            <button 
              onClick={() => setShowModal(true)} 
              className="btn btn-primary"
              disabled={loading}
            >
              Add Instructor
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
            placeholder="Search instructors by ID, name, or course..."
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
                <th>ID</th>
                <th>Name</th>
                <th>Qualified Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstructors.map((ins) => (
                <tr key={ins._id}>
                  <td>{ins.instructorID}</td>
                  <td>{ins.name}</td>
                  <td>{formatQualifiedCourses(ins.qualifiedCourses)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(ins)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ins._id)}
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

          {filteredInstructors.length === 0 && !loading && (
            <div className="empty-state">
              <h3>No instructors found</h3>
              <p>{searchTerm ? "Try a different search term" : "Add your first instructor to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "90%" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingInstructor ? "Edit Instructor" : "Add New Instructor"}
              </h2>
              <button onClick={resetForm} className="modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Instructor ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.instructorID}
                  onChange={(e) =>
                    setFormData({ ...formData, instructorID: e.target.value })
                  }
                  required
                  disabled={!!editingInstructor || loading}
                  placeholder="e.g., INS001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                  placeholder="e.g., John Doe"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualified Courses</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search courses..."
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                  style={{ marginBottom: "0.5rem" }}
                  disabled={loading}
                />
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                >
                  {filteredCourses.map((course) => {
                    const assignedInstructor = getAssignedInstructor(course.courseID);
                    const isCurrentlySelected = formData.qualifiedCourses.includes(course.courseID);
                    return (
                      <label
                        key={course.courseID}
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          marginBottom: "0.5rem",
                          padding: "0.25rem",
                          backgroundColor: isCurrentlySelected ? "#e0f2fe" : "transparent",
                          borderRadius: "0.25rem",
                          cursor: loading ? "not-allowed" : "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCurrentlySelected}
                          onChange={() => handleCourseToggle(course.courseID)}
                          style={{ marginRight: "0.5rem" }}
                          disabled={loading}
                        />
                        <span style={{ flex: 1 }}>
                          {course.courseID} - {course.courseName} ({course.type})
                          <br />
                          <small style={{ color: "#6b7280" }}>Assigned: {assignedInstructor}</small>
                        </span>
                      </label>
                    );
                  })}
                  {filteredCourses.length === 0 && (
                    <p style={{ textAlign: "center", color: "#6b7280", padding: "1rem" }}>
                      {courseSearchTerm ? "No courses match your search" : "No courses found"}
                    </p>
                  )}
                </div>
                {formData.qualifiedCourses.length > 0 && (
                  <small style={{ color: "#6b7280", marginTop: "0.5rem", display: "block" }}>
                    {formData.qualifiedCourses.length} course(s) selected
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Time Preferences</label>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#10b981", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "0.875rem" }}>Preferred</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#ef4444", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "0.875rem" }}>Unavailable</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "20px", height: "20px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px" }}></div>
                      <span style={{ fontSize: "0.875rem" }}>Available</span>
                    </div>
                  </div>
                  <small style={{ color: "#6b7280", display: "block", marginBottom: "0.5rem" }}>
                    Click 'P' to mark as preferred, 'U' to mark as unavailable
                  </small>
                </div>
                
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", position: "sticky", left: 0, zIndex: 1 }}>Time</th>
                        {days.map((day, dayIndex) => (
                          <th key={day} style={{ padding: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", minWidth: "80px" }}>
                            <div>{day.substring(0, 3)}</div>
                            <small style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                              ({dayIndex * 8}-{dayIndex * 8 + 7})
                            </small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((time, timeIndex) => (
                        <tr key={time}>
                          <td style={{ padding: "0.5rem", border: "1px solid #d1d5db", fontWeight: "500", fontSize: "0.75rem", backgroundColor: "#fff", position: "sticky", left: 0, zIndex: 1 }}>
                            {time}
                          </td>
                          {days.map((day, dayIndex) => {
                            const slotIndex = dayIndex * 8 + timeIndex;
                            const status = getSlotStatus(slotIndex);
                            return (
                              <td key={`${day}-${timeIndex}`} style={{ padding: "0.25rem", border: "1px solid #d1d5db", position: "relative" }}>
                                <div style={{ fontSize: "0.65rem", color: "#9ca3af", position: "absolute", top: "2px", left: "2px" }}>
                                  {slotIndex}
                                </div>
                                <div style={{ display: "flex", gap: "0.25rem", marginTop: "12px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotToggle(slotIndex, 'preferredTimeSlots')}
                                    disabled={loading || status === 'unavailable'}
                                    style={{
                                      width: "100%",
                                      height: "30px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "4px",
                                      backgroundColor: status === 'preferred' ? "#10b981" : "#f3f4f6",
                                      color: status === 'preferred' ? "#fff" : "#374151",
                                      cursor: status === 'unavailable' || loading ? "not-allowed" : "pointer",
                                      fontSize: "0.75rem",
                                      fontWeight: status === 'preferred' ? "600" : "400",
                                      transition: "all 0.2s"
                                    }}
                                    title={`Slot ${slotIndex}: Click to set as preferred`}
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotToggle(slotIndex, 'unavailableTimeSlots')}
                                    disabled={loading || status === 'preferred'}
                                    style={{
                                      width: "100%",
                                      height: "30px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "4px",
                                      backgroundColor: status === 'unavailable' ? "#ef4444" : "#f3f4f6",
                                      color: status === 'unavailable' ? "#fff" : "#374151",
                                      cursor: status === 'preferred' || loading ? "not-allowed" : "pointer",
                                      fontSize: "0.75rem",
                                      fontWeight: status === 'unavailable' ? "600" : "400",
                                      transition: "all 0.2s"
                                    }}
                                    title={`Slot ${slotIndex}: Click to set as unavailable`}
                                  >
                                    U
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(formData.preferredTimeSlots.length > 0 || formData.unavailableTimeSlots.length > 0) && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
                    <div>
                      <strong>Preferred Slots:</strong> {formData.preferredTimeSlots.sort((a, b) => a - b).join(", ") || "None"}
                    </div>
                    <div>
                      <strong>Unavailable Slots:</strong> {formData.unavailableTimeSlots.sort((a, b) => a - b).join(", ") || "None"}
                    </div>
                  </div>
                )}
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
                  {loading ? "Processing..." : (editingInstructor ? "Update Instructor" : "Create Instructor")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Instructors;