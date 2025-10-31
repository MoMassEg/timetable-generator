import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const TimetableView = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const timetableID = localStorage.getItem('selectedTimetableID');
  const backendDataURL = `http://localhost:5000/api/data/${timetableID}`;
  const schedulerAPI = "http://127.0.0.1:8080/api/schedule";
  useEffect(() => {
    setLoading(false);
  }, []);

  const fetchAndGenerateSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const dataResponse = await axios.get(backendDataURL);

      if (!dataResponse.data) throw new Error("Invalid data response");

      const scheduleResponse = await axios.post(schedulerAPI, dataResponse.data);
    
      if (scheduleResponse.data?.success) {
        setSections(scheduleResponse.data.sections || []);
      } else {
        setError("Schedule generation failed");
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.response?.data?.error || "Failed to generate schedule");
    } finally {
      setLoading(false);
    }
  };

  const getAllInstructors = () => {
    const instructors = new Set();
    sections.forEach(section => {
      section.schedule.forEach(session => {
        instructors.add(session.instructorName);
      });
    });
    return Array.from(instructors).sort();
  };

  const getAllRooms = () => {
    const rooms = new Set();
    sections.forEach(section => {
      section.schedule.forEach(session => {
        rooms.add(session.roomID);
      });
    });
    return Array.from(rooms).sort();
  };

  const getTimeLabel = (slotIndex) => {
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
    return times[slotIndex % 8] || `Slot ${slotIndex}`;
  };

  const getFilteredSections = () => {
    if (selectedInstructor === "all" && selectedRoom === "all") {
      return sections;
    }

    return sections.map(section => {
      const filteredSchedule = section.schedule.filter(session => {
        const matchInstructor = selectedInstructor === "all" || session.instructorName === selectedInstructor;
        const matchRoom = selectedRoom === "all" || session.roomID === selectedRoom;
        return matchInstructor && matchRoom;
      });

      return {
        ...section,
        schedule: filteredSchedule
      };
    }).filter(section => section.schedule.length > 0);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const filteredSections = getFilteredSections();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
    
    let filterText = "Generated Timetable";
    if (selectedInstructor !== "all") filterText += ` | Instructor: ${selectedInstructor}`;
    if (selectedRoom !== "all") filterText += ` | Room: ${selectedRoom}`;
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(filterText, 14, 15);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`, 14, 22);

    days.forEach((day, dayIndex) => {
      if (dayIndex > 0) {
        doc.addPage();
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(day, 14, 35);

      const tableData = [];
      const timeSlots = Array.from({ length: 8 }, (_, i) => i);

      timeSlots.forEach((slot) => {
        const slotIndex = dayIndex * 8 + slot;
        const row = [getTimeLabel(slot)];

        filteredSections.forEach(section => {
          const session = section.schedule.find(s => s.slotIndex === slotIndex);
          if (session) {
            row.push(
              `${session.courseID}\n${session.courseName}\n${session.instructorName}\n${session.roomID}`
            );
          } else {
            row.push('');
          }
        });

        tableData.push(row);
      });

      const headers = ['Time', ...filteredSections.map(s => 
        `${s.sectionID}\n${s.groupID} - Year ${s.year}`
      )];

      doc.autoTable({
        startY: 40,
        head: [headers],
        body: tableData,
        theme: 'grid',
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
          lineColor: [209, 213, 219],
          lineWidth: 0.5,
          textColor: [17, 24, 39],
          font: 'helvetica'
        },
        headStyles: { 
          fillColor: [55, 65, 81],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          cellPadding: 4
        },
        columnStyles: {
          0: { 
            cellWidth: 25, 
            fontStyle: 'bold',
            fillColor: [243, 244, 246],
            textColor: [55, 65, 81],
            halign: 'center'
          }
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index > 0) {
            const section = filteredSections[data.column.index - 1];
            const slotIndex = dayIndex * 8 + data.row.index;
            const session = section?.schedule.find(s => s.slotIndex === slotIndex);
            
            if (session) {
              if (session.type === 'lec') {
                data.cell.styles.fillColor = [219, 234, 254];
                data.cell.styles.textColor = [30, 64, 175];
              } else if (session.type === 'lab') {
                data.cell.styles.fillColor = [254, 243, 199];
                data.cell.styles.textColor = [146, 64, 14];
              } else if (session.type === 'tut') {
                data.cell.styles.fillColor = [209, 250, 229];
                data.cell.styles.textColor = [6, 95, 70];
              }
            }
          }
        },
        margin: { top: 40, left: 14, right: 14 }
      });

      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`Page ${dayIndex + 1} of ${days.length}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
    });

    doc.save(`timetable_${new Date().getTime()}.pdf`);
    setShowSaveMenu(false);
  };

  const exportToExcel = () => {
    const filteredSections = getFilteredSections();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
    const workbook = XLSX.utils.book_new();

    days.forEach((day, dayIndex) => {
      const worksheetData = [];
      
      worksheetData.push([day]);
      worksheetData.push([]);
      
      const headerRow = ['Time'];
      filteredSections.forEach(section => {
        headerRow.push(`${section.sectionID} - ${section.groupID} (Year ${section.year})`);
      });
      worksheetData.push(headerRow);

      const timeSlots = Array.from({ length: 8 }, (_, i) => i);
      timeSlots.forEach((slot) => {
        const slotIndex = dayIndex * 8 + slot;
        const row = [getTimeLabel(slot)];

        filteredSections.forEach(section => {
          const session = section.schedule.find(s => s.slotIndex === slotIndex);
          if (session) {
            row.push(
              `${session.courseID} - ${session.courseName}\nInstructor: ${session.instructorName}\nRoom: ${session.roomID}\nType: ${session.type.toUpperCase()}`
            );
          } else {
            row.push('');
          }
        });

        worksheetData.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      worksheet['!cols'] = [
        { wch: 18 },
        ...filteredSections.map(() => ({ wch: 35 }))
      ];

      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          
          if (R === 0) {
            worksheet[cellAddress].s = {
              font: { bold: true, sz: 14, color: { rgb: "1F2937" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          } else if (R === 2) {
            worksheet[cellAddress].s = {
              fill: { fgColor: { rgb: "374151" } },
              font: { bold: true, color: { rgb: "FFFFFF" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              border: {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
              }
            };
          } else if (R > 2 && C === 0) {
            worksheet[cellAddress].s = {
              fill: { fgColor: { rgb: "F3F4F6" } },
              font: { bold: true, color: { rgb: "374151" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
              }
            };
          } else if (R > 2 && C > 0) {
            const cellValue = worksheet[cellAddress].v;
            let fillColor = "FFFFFF";
            
            if (cellValue && cellValue.includes('Type:')) {
              if (cellValue.includes('Type: LEC')) {
                fillColor = "DBEAFE";
              } else if (cellValue.includes('Type: LAB')) {
                fillColor = "FEF3C7";
              } else if (cellValue.includes('Type: TUT')) {
                fillColor = "D1FAE5";
              }
            }
            
            worksheet[cellAddress].s = {
              fill: { fgColor: { rgb: fillColor } },
              alignment: { vertical: "top", wrapText: true },
              border: {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
              }
            };
          }
        }
      }

      worksheet['!rows'] = [
        { hpt: 25 },
        { hpt: 10 },
        { hpt: 35 },
        ...timeSlots.map(() => ({ hpt: 60 }))
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, day);
    });

    let filterText = '';
    if (selectedInstructor !== "all") filterText += `_${selectedInstructor.replace(/\s+/g, '_')}`;
    if (selectedRoom !== "all") filterText += `_${selectedRoom}`;

    XLSX.writeFile(workbook, `timetable${filterText}_${new Date().getTime()}.xlsx`);
    setShowSaveMenu(false);
  };

  const renderTimetable = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
    const timeSlots = Array.from({ length: 8 }, (_, i) => i);

    const filteredSections = getFilteredSections();

    if (filteredSections.length === 0) {
      return (
        <div className="empty-state">
          <h3>No matching sessions found</h3>
          <p>Try changing the filters above.</p>
        </div>
      );
    }

    const sectionData = filteredSections.map((section) => {
      const sessionMap = {};
      const occupiedSlots = new Set();

      section.schedule.forEach((s) => {
        sessionMap[s.slotIndex] = s;
        for (let i = 1; i < s.duration; i++) {
          occupiedSlots.add(s.slotIndex + i);
        }
      });

      return {
        section,
        sessionMap,
        occupiedSlots
      };
    });

    return (
      <div className="timetable-container">
        <table className="timetable-table">
          <thead>
            <tr>
              <th className="day-time-header" colSpan="2">
                Section
              </th>
              {filteredSections.map((section) => (
                <th key={section.sectionID} className="section-header">
                  <div className="section-info">
                    <div className="section-id">{section.sectionID}</div>
                    <div className="section-details">
                      {section.groupID} - Year {section.year}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, dayIndex) => (
              <React.Fragment key={day}>
                {timeSlots.map((slot, slotIdx) => {
                  const slotIndex = dayIndex * 8 + slot;
                  const isFirstSlotOfDay = slotIdx === 0;

                  return (
                    <tr key={`${day}-${slot}`}>
                      {isFirstSlotOfDay && (
                        <td rowSpan={8} className="day-cell">
                          <div className="day-label">{day}</div>
                        </td>
                      )}

                      <td className="time-cell">{getTimeLabel(slot)}</td>

                      {sectionData.map(({ section, sessionMap, occupiedSlots }) => {
                        if (occupiedSlots.has(slotIndex)) {
                          return null;
                        }

                        const session = sessionMap[slotIndex];

                        if (session) {
                          return (
                            <td
                              key={`${section.sectionID}-${slotIndex}`}
                              rowSpan={session.duration}
                              className={`session-cell ${session.type.toLowerCase()}`}
                            >
                              <div className="session-content">
                                <div className="course-code">{session.courseID}</div>
                                <div className="course-name">{session.courseName}</div>
                                <div className="instructor">{session.instructorName}</div>
                                <div className="room">{session.roomID}</div>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`${section.sectionID}-${slotIndex}`}
                            className="empty-cell"
                          >
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading)
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Generating timetable...</p>
      </div>
    );

  if (error)
    return (
      <div className="error-container">
        <div className="error-header">
          <h1>Timetable Generation Error</h1>
          <button onClick={fetchAndGenerateSchedule} className="btn-refresh">
            Retry
          </button>
        </div>
        <div className="error-message">
          <h3>{error}</h3>
          <p>Try refreshing or check your backend server connections.</p>
        </div>
      </div>
    );

  return (
    <div className="timetable-wrapper">
      <div className="header-card">
        <div>
          <h1>Generated Timetable</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
          {sections.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowSaveMenu(!showSaveMenu)} 
                className="btn-save"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              
              {showSaveMenu && (
                <>
                  <div 
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 40
                    }}
                    onClick={() => setShowSaveMenu(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 50,
                    minWidth: '180px',
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={exportToPDF}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#374151',
                        fontWeight: '500',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                      Export as PDF
                    </button>
                    <button
                      onClick={exportToExcel}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#374151',
                        fontWeight: '500',
                        borderTop: '1px solid #e5e7eb',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <rect x="8" y="12" width="8" height="8"/>
                      </svg>
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={fetchAndGenerateSchedule} className="btn-refresh">
            Generate
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="empty-state">
          <h3>No sections found</h3>
          <p>Click Generate to create a new timetable.</p>
        </div>
      ) : (
        <>
          <div className="filter-controls">
            <div className="filter-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <span>Filter Timetable:</span>
            </div>
            
            <div className="filter-dropdowns">
              <div className="filter-group">
                <label>Instructor / TA:</label>
                <select 
                  value={selectedInstructor}
                  onChange={(e) => setSelectedInstructor(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Instructors & TAs</option>
                  {getAllInstructors().map(inst => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Room:</label>
                <select 
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Rooms</option>
                  {getAllRooms().map(room => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              {(selectedInstructor !== "all" || selectedRoom !== "all") && (
                <button 
                  onClick={() => {
                    setSelectedInstructor("all");
                    setSelectedRoom("all");
                  }}
                  className="btn-clear-filters"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {renderTimetable()}
        </>
      )}
    </div>
  );
};

export default TimetableView;
