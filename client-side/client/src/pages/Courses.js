import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [timetableID, setTimetableID] = useState("");
  const [formData, setFormData] = useState({
    courseID: "",
    courseName: "",
    type: "lec",
    labType: "",
    duration: 1,
    priority: 0,
    allYear: false,
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
      fetchCourses();
      fetchInstructors();
      setSearchTerm("");
      setShowModal(false);
      resetForm();
    } else {
      setCourses([]);
      setInstructors([]);
      setError("Please select a timetable first");
    }
  }, [timetableID]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(
        `http://localhost:5000/api/courses/${timetableID}`
      );
      setCourses(res.data);
    } catch (err) {
      console.error("Error fetching courses:", err);
      setError("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructors = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/instructors/${timetableID}`
      );
      setInstructors(res.data);
    } catch (err) {
      console.error("Error fetching instructors:", err);
    }
  };

  const getAssignedInstructor = (courseID) => {
    const instructor = instructors.find((inst) =>
      inst.qualifiedCourses?.includes(courseID)
    );
    return instructor ? instructor.name : "Not Assigned";
  };

  const handleExportToExcel = () => {
    try {
      const exportData = courses.map(course => {
        return {
          'Course ID': course.courseID,
          'Course Name': course.courseName,
          'Type': course.type,
          'Lab Type': course.labType || '',
          'Duration': course.duration,
          'Priority': course.priority || 0,
          'All Year': course.allYear ? 'Yes' : 'No',
          'Assigned Instructor': getAssignedInstructor(course.courseID)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");

      worksheet['!cols'] = [
        { wch: 15 },  
        { wch: 30 },  
        { wch: 10 },  
        { wch: 15 },  
        { wch: 10 },  
        { wch: 10 },  
        { wch: 10 },  
        { wch: 25 }   
      ];

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `courses_${timetableID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
      
      setError("");
      alert(`Successfully exported ${courses.length} courses to Excel!`);
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
        console.log(`Found ${jsonData.length} courses in Excel file`);

        const importedCourses = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            if (!row['Course ID'] || !row['Course Name']) {
              errors.push(`Row ${i + 2}: Missing Course ID or Course Name`);
              continue;
            }

            const type = row['Type']?.toLowerCase().trim();
            if (!['lec', 'tut', 'lab'].includes(type)) {
              errors.push(`Row ${i + 2}: Invalid type "${row['Type']}". Must be lec, tut, or lab`);
              continue;
            }

            const duration = parseInt(row['Duration']);
            if (isNaN(duration) || duration < 1) {
              errors.push(`Row ${i + 2}: Invalid duration "${row['Duration']}". Must be a number >= 1`);
              continue;
            }

            const priority = parseInt(row['Priority']) || 0;
            if (priority < 0) {
              errors.push(`Row ${i + 2}: Invalid priority "${row['Priority']}". Must be >= 0`);
              continue;
            }

            const allYearValue = String(row['All Year']).toLowerCase().trim();
            const allYear = ['yes', 'true', '1', 'y'].includes(allYearValue);

            importedCourses.push({
              courseID: String(row['Course ID']).trim(),
              courseName: String(row['Course Name']).trim(),
              type: type,
              labType: row['Lab Type'] ? String(row['Lab Type']).trim() : '',
              duration: duration,
              priority: priority,
              allYear: allYear,
              timetableID
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err.message}`);
          }
        }

        if (errors.length > 0) {
          setImportError(`Import warnings:\n${errors.join('\n')}`);
        }

        console.log(`Valid courses to import: ${importedCourses.length}`);

        let successCount = 0;
        let failCount = 0;
        let updatedCount = 0;
        let createdCount = 0;
        const failedCourses = [];

        for (const course of importedCourses) {
          try {
            const existingCourse = courses.find(c => c.courseID === course.courseID);

            if (existingCourse) {
              await axios.put(`http://localhost:5000/api/courses/${existingCourse._id}`, course);
              successCount++;
              updatedCount++;
              console.log(`Updated: ${course.courseID}`);
            } else {
              await axios.post("http://localhost:5000/api/courses", course);
              successCount++;
              createdCount++;
              console.log(`Created: ${course.courseID}`);
            }
          } catch (err) {
            failCount++;
            const errorMsg = err.response?.data?.error || err.message;
            failedCourses.push(`${course.courseID}: ${errorMsg}`);
            console.error(`Error importing course ${course.courseID}:`, errorMsg);
          }
        }

        await fetchCourses();

        let message = `Import completed!\n✓ ${successCount} courses imported successfully`;
        if (createdCount > 0) message += `\n  - ${createdCount} new courses created`;
        if (updatedCount > 0) message += `\n  - ${updatedCount} existing courses updated`;
        
        if (failCount > 0) {
          message += `\n✗ ${failCount} failed:\n${failedCourses.join('\n')}`;
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
        'Course ID': 'CS101',
        'Course Name': 'Introduction to Programming',
        'Type': 'lec',
        'Lab Type': '',
        'Duration': 1,
        'Priority': 5,
        'All Year': 'No'
      },
      {
        'Course ID': 'CS101L',
        'Course Name': 'Programming Lab',
        'Type': 'lab',
        'Lab Type': 'Computer',
        'Duration': 2,
        'Priority': 3,
        'All Year': 'No'
      },
      {
        'Course ID': 'MATH201',
        'Course Name': 'Calculus II',
        'Type': 'lec',
        'Lab Type': '',
        'Duration': 1,
        'Priority': 10,
        'All Year': 'Yes'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 }
    ];

    const instructions = [
      { 'Field': 'Course ID', 'Description': 'Unique identifier for the course (required)', 'Example': 'CS101', 'Valid Values': 'Any text' },
      { 'Field': 'Course Name', 'Description': 'Full name of the course (required)', 'Example': 'Introduction to Programming', 'Valid Values': 'Any text' },
      { 'Field': 'Type', 'Description': 'Type of course (required)', 'Example': 'lec', 'Valid Values': 'lec, tut, lab' },
      { 'Field': 'Lab Type', 'Description': 'Type of lab (optional)', 'Example': 'Computer', 'Valid Values': 'Any text or leave empty' },
      { 'Field': 'Duration', 'Description': 'Duration in periods (required)', 'Example': '1', 'Valid Values': 'Number >= 1' },
      { 'Field': 'Priority', 'Description': 'Scheduling priority (optional)', 'Example': '5', 'Valid Values': 'Number >= 0 (default: 0)' },
      { 'Field': 'All Year', 'Description': 'Whether course runs all year', 'Example': 'Yes', 'Valid Values': 'Yes/No, True/False, Y/N' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 25 }, { wch: 25 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'courses_template.xlsx');
    
    alert('Template downloaded!\n\nCheck the sheets:\n• Template - Sample data\n• Instructions - Field descriptions and valid values');
  };

  const filteredCourses = courses.filter((course) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const assignedInstructor = getAssignedInstructor(course.courseID);
    return (
      course.courseID.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      course.type.toLowerCase().includes(searchLower) ||
      (course.labType && course.labType.toLowerCase().includes(searchLower)) ||
      assignedInstructor.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (editingCourse) {
        await axios.put(
          `http://localhost:5000/api/courses/${editingCourse._id}`,
          {
            ...formData,
            timetableID,
          }
        );
      } else {
        await axios.post("http://localhost:5000/api/courses", {
          ...formData,
          timetableID,
        });
      }
      fetchCourses();
      resetForm();
    } catch (err) {
      console.error("Error saving course:", err);
      setError(err.response?.data?.error || "Failed to save course");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      courseID: course.courseID,
      courseName: course.courseName,
      type: course.type,
      labType: course.labType || "",
      duration: course.duration,
      priority: course.priority || 0,
      allYear: course.allYear || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this course?")) {
      try {
        setLoading(true);
        await axios.delete(`http://localhost:5000/api/courses/${id}`);
        fetchCourses();
      } catch (err) {
        console.error("Error deleting course:", err);
        setError("Failed to delete course");
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setEditingCourse(null);
    setFormData({
      courseID: "",
      courseName: "",
      type: "lec",
      labType: "",
      duration: 1,
      priority: 0,
      allYear: false,
    });
    setShowModal(false);
  };

  if (!timetableID) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No Timetable Selected</h3>
          <p>Please select a timetable from the sidebar to manage courses</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Course Management</h1>
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
              disabled={loading || courses.length === 0}
              title="Export all courses to Excel"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              Export
            </button>
            
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary"
              disabled={loading}
            >
              Add Course
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
            placeholder="Search courses by ID, name, type, lab type, or instructor..."
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
                <th>Type</th>
                <th>Lab Type</th>
                <th>Duration</th>
                <th>Priority</th>
                <th>All Year</th>
                <th>Assigned Instructor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course._id}>
                  <td>{course.courseID}</td>
                  <td>{course.courseName}</td>
                  <td>
                    <span className={`badge badge-${course.type === 'lec' ? 'primary' : course.type === 'lab' ? 'warning' : 'info'}`}>
                      {course.type}
                    </span>
                  </td>
                  <td>{course.labType || "—"}</td>
                  <td>{course.duration}</td>
                  <td>{course.priority || 0}</td>
                  <td>
                    <span
                      className={`badge ${
                        course.allYear ? "badge-success" : "badge-secondary"
                      }`}
                    >
                      {course.allYear ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{getAssignedInstructor(course.courseID)}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(course)}
                      className="btn btn-sm btn-secondary"
                      style={{ marginRight: "0.5rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(course._id)}
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

          {filteredCourses.length === 0 && !loading && (
            <div className="empty-state">
              <h3>No courses found</h3>
              <p>
                {searchTerm
                  ? "Try a different search term"
                  : "Add your first course to get started"}
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
                {editingCourse ? "Edit Course" : "Add New Course"}
              </h2>
              <button onClick={resetForm} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Course ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.courseID}
                  onChange={(e) =>
                    setFormData({ ...formData, courseID: e.target.value })
                  }
                  required
                  disabled={!!editingCourse || loading}
                  placeholder="e.g., CS101"
                />
                {editingCourse && (
                  <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                    Course ID cannot be changed
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.courseName}
                  onChange={(e) =>
                    setFormData({ ...formData, courseName: e.target.value })
                  }
                  required
                  disabled={loading}
                  placeholder="e.g., Introduction to Programming"
                />
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
                  <option value="tut">Tutorial (tut)</option>
                  <option value="lab">Lab (lab)</option>
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
                <label className="form-label">Duration (in periods)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                  min="1"
                  disabled={loading}
                  placeholder="1"
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Number of consecutive periods (1 period = 45 minutes)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  placeholder="0"
                  disabled={loading}
                />
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem" }}>
                  Higher priority courses are scheduled first (0 = lowest priority)
                </small>
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.allYear}
                    onChange={(e) =>
                      setFormData({ ...formData, allYear: e.target.checked })
                    }
                    style={{ marginRight: "0.5rem", cursor: "pointer" }}
                    disabled={loading}
                  />
                  All Year Course
                </label>
                <small style={{ color: "#6b7280", display: "block", marginTop: "0.25rem", marginLeft: "1.75rem" }}>
                  Check if this course runs throughout the entire academic year
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
                  {loading
                    ? "Processing..."
                    : editingCourse
                    ? "Update Course"
                    : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;