import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

const TimetableView = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const timetableRef = useRef(null);
  
  const timetableID = localStorage.getItem('selectedTimetableID');
  const backendDataURL = `http://localhost:5000/api/data/${timetableID}`;
  const schedulerAPI = "http://127.0.0.1:8080/api/schedule";
  
  const CACHE_KEY = `timetable_cache_${timetableID}`;
  const CACHE_TIMESTAMP_KEY = `timetable_cache_timestamp_${timetableID}`;
  const CACHE_DURATION = 30 * 60 * 1000;

  useEffect(() => {
    const loadData = async () => {
      const cacheLoaded = await loadCachedData();
      if (!cacheLoaded) {
        await fetchAndGenerateSchedule();
      }
    };
    loadData();
  }, []);

  const loadCachedData = async () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      
      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION) {
          const parsedData = JSON.parse(cachedData);
          setSections(parsedData);
          setLoading(false);
          return true;
        } else {
          clearCache();
        }
      }
    } catch (err) {
      clearCache();
    }
    return false;
  };

  const saveToCache = (data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        clearCache();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (retryErr) {
        }
      }
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  };

  const fetchAndGenerateSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const dataResponse = await axios.get(backendDataURL);
      if (!dataResponse.data) throw new Error("Invalid data response");

      const scheduleResponse = await axios.post(schedulerAPI, dataResponse.data);
    
      if (scheduleResponse.data?.success) {
        const newSections = scheduleResponse.data.sections || [];
        setSections(newSections);
        saveToCache(newSections);
      } else {
        setError("Schedule generation failed");
      }
    } catch (err) {
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

  // Helper function to check if two sessions are identical
  const areSessionsIdentical = (session1, session2) => {
    if (!session1 || !session2) return false;
    return (
      session1.courseID === session2.courseID &&
      session1.courseName === session2.courseName &&
      session1.instructorName === session2.instructorName &&
      session1.roomID === session2.roomID &&
      session1.type === session2.type
    );
  };

  // Helper function to determine if there's a separator needed
  const needsSeparator = (currentSection, nextSection, type) => {
    if (!nextSection) return false;
    
    if (type === 'year') {
      return currentSection.year !== nextSection.year;
    } else if (type === 'group') {
      return currentSection.year === nextSection.year && 
             currentSection.groupID !== nextSection.groupID;
    }
    return false;
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    try {
      const filteredSections = getFilteredSections();
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
      const workbook = XLSX.utils.book_new();

      days.forEach((day, dayIndex) => {
        const worksheetData = [];
        const mergeRanges = [];
        
        // Title
        worksheetData.push([`${day} - Timetable`]);
        worksheetData.push([]);
        worksheetData.push([`Generated: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`]);
        worksheetData.push([]);
        
        // Headers
        const headerRow = ['Time'];
        filteredSections.forEach(section => {
          headerRow.push(`${section.sectionID}\n${section.groupID} - Year ${section.year}`);
        });
        worksheetData.push(headerRow);

        const timeSlots = Array.from({ length: 8 }, (_, i) => i);
        
        timeSlots.forEach((slot) => {
          const slotIndex = dayIndex * 8 + slot;
          const row = [getTimeLabel(slot)];
          const rowIndex = worksheetData.length;
          
          let colIndex = 1;
          let skipColumns = new Set();

          for (let i = 0; i < filteredSections.length; i++) {
            if (skipColumns.has(i)) {
              continue;
            }

            const section = filteredSections[i];
            const session = section.schedule.find(s => s.slotIndex === slotIndex);
            
            if (session) {
              // Check how many consecutive sections have the same session
              let mergeCount = 1;
              for (let j = i + 1; j < filteredSections.length; j++) {
                const nextSection = filteredSections[j];
                const nextSession = nextSection.schedule.find(s => s.slotIndex === slotIndex);
                
                if (areSessionsIdentical(session, nextSession)) {
                  mergeCount++;
                  skipColumns.add(j);
                } else {
                  break;
                }
              }

              const cellValue = `${session.courseID}\n${session.courseName}\n\nInstructor: ${session.instructorName}\nRoom: ${session.roomID}\nType: ${session.type.toUpperCase()}`;
              row.push(cellValue);
              
              // Add merge range if merging multiple columns
              if (mergeCount > 1) {
                mergeRanges.push({
                  s: { r: rowIndex, c: colIndex },
                  e: { r: rowIndex, c: colIndex + mergeCount - 1 }
                });
                // Add empty cells for merged columns
                for (let k = 1; k < mergeCount; k++) {
                  row.push('');
                }
                colIndex += mergeCount;
              } else {
                colIndex++;
              }
            } else {
              row.push('');
              colIndex++;
            }
          }

          worksheetData.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Apply merges
        if (mergeRanges.length > 0) {
          worksheet['!merges'] = mergeRanges;
        }

        // Column widths
        worksheet['!cols'] = [
          { wch: 20 },
          ...filteredSections.map(() => ({ wch: 38 }))
        ];

        // Row heights
        worksheet['!rows'] = [
          { hpt: 35 },
          { hpt: 10 },
          { hpt: 20 },
          { hpt: 10 },
          { hpt: 40 },
          ...timeSlots.map(() => ({ hpt: 90 }))
        ];

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Apply styles
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;
            
            let borderStyle = {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } }
            };

            // Check for separators
            if (C > 0 && R > 4) {
              const sectionIndex = C - 1;
              if (sectionIndex < filteredSections.length - 1) {
                const currentSection = filteredSections[sectionIndex];
                const nextSection = filteredSections[sectionIndex + 1];
                
                // Year separator (thick border)
                if (needsSeparator(currentSection, nextSection, 'year')) {
                  borderStyle.right = { style: "thick", color: { rgb: "1E293B" } };
                }
                // Group separator (medium border)
                else if (needsSeparator(currentSection, nextSection, 'group')) {
                  borderStyle.right = { style: "medium", color: { rgb: "475569" } };
                }
              }
            }
            
            if (R === 0) {
              worksheet[cellAddress].s = {
                font: { 
                  bold: true, 
                  sz: 18, 
                  color: { rgb: "1F2937" },
                  name: 'Calibri'
                },
                fill: { 
                  fgColor: { rgb: "F3F4F6" }
                },
                alignment: { 
                  horizontal: "left", 
                  vertical: "center",
                  wrapText: true
                },
                border: {
                  bottom: { style: "thick", color: { rgb: "374151" } }
                }
              };
            }
            else if (R === 2) {
              worksheet[cellAddress].s = {
                font: { 
                  sz: 10, 
                  color: { rgb: "6B7280" },
                  italic: true,
                  name: 'Calibri'
                },
                alignment: { 
                  horizontal: "left", 
                  vertical: "center" 
                }
              };
            }
            else if (R === 4) {
              // Check for separators in header
              if (C > 0 && C < filteredSections.length) {
                const sectionIndex = C - 1;
                if (sectionIndex < filteredSections.length - 1) {
                  const currentSection = filteredSections[sectionIndex];
                  const nextSection = filteredSections[sectionIndex + 1];
                  
                  if (needsSeparator(currentSection, nextSection, 'year')) {
                    borderStyle.right = { style: "thick", color: { rgb: "1E293B" } };
                  } else if (needsSeparator(currentSection, nextSection, 'group')) {
                    borderStyle.right = { style: "medium", color: { rgb: "475569" } };
                  }
                }
              }

              worksheet[cellAddress].s = {
                fill: { 
                  fgColor: { rgb: C === 0 ? "334155" : "475569" }
                },
                font: { 
                  bold: true, 
                  color: { rgb: "FFFFFF" },
                  sz: 12,
                  name: 'Calibri'
                },
                alignment: { 
                  horizontal: "center", 
                  vertical: "center", 
                  wrapText: true 
                },
                border: {
                  ...borderStyle,
                  top: { style: "medium", color: { rgb: "1E293B" } },
                  bottom: { style: "medium", color: { rgb: "1E293B" } }
                }
              };
            }
            else if (R > 4 && C === 0) {
              worksheet[cellAddress].s = {
                fill: { 
                  fgColor: { rgb: "F1F5F9" }
                },
                font: { 
                  bold: true, 
                  color: { rgb: "334155" },
                  sz: 11,
                  name: 'Calibri'
                },
                alignment: { 
                  horizontal: "center", 
                  vertical: "center" 
                },
                border: {
                  top: { style: "thin", color: { rgb: "CBD5E1" } },
                  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                  left: { style: "medium", color: { rgb: "94A3B8" } },
                  right: { style: "medium", color: { rgb: "94A3B8" } }
                }
              };
            }
            else if (R > 4 && C > 0) {
              const cellValue = worksheet[cellAddress].v;
              let fillColor = "FFFFFF";
              let textColor = "1E293B";
              let fontWeight = false;
              
              if (cellValue && cellValue.includes('Type:')) {
                if (cellValue.includes('LEC')) {
                  fillColor = "DBEAFE";
                  textColor = "1E3A8A";
                  fontWeight = true;
                } else if (cellValue.includes('LAB')) {
                  fillColor = "FEF9C3";
                  textColor = "78350F";
                  fontWeight = true;
                } else if (cellValue.includes('TUT')) {
                  fillColor = "DCFCE7";
                  textColor = "14532D";
                  fontWeight = true;
                }
              }
              
              if (!cellValue || cellValue === '') {
                fillColor = (R - 5) % 2 === 0 ? "FFFFFF" : "F8FAFC";
              }
              
              worksheet[cellAddress].s = {
                fill: { 
                  fgColor: { rgb: fillColor } 
                },
                font: {
                  color: { rgb: textColor },
                  sz: 10,
                  bold: fontWeight,
                  name: 'Calibri'
                },
                alignment: { 
                  vertical: "top", 
                  horizontal: "left",
                  wrapText: true,
                  indent: 1
                },
                border: borderStyle
              };
            }
          }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, day);
      });

      let filterText = '';
      if (selectedInstructor !== "all") filterText += `_${selectedInstructor.replace(/\s+/g, '_')}`;
      if (selectedRoom !== "all") filterText += `_${selectedRoom}`;

      XLSX.writeFile(workbook, `timetable${filterText}_${new Date().getTime()}.xlsx`);
      setShowSaveMenu(false);
    } catch (err) {
      alert("Failed to export Excel. Error: " + err.message);
    }
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
      <div className="timetable-container" ref={timetableRef} id="printable-timetable">
        <table className="timetable-table">
          <thead>
            <tr>
              <th className="day-time-header" colSpan="2">
                Section
              </th>
              {filteredSections.map((section, idx) => {
                const isYearSeparator = idx < filteredSections.length - 1 && 
                  needsSeparator(section, filteredSections[idx + 1], 'year');
                const isGroupSeparator = idx < filteredSections.length - 1 && 
                  needsSeparator(section, filteredSections[idx + 1], 'group');
                
                return (
                  <th 
                    key={section.sectionID} 
                    className={`section-header ${isYearSeparator ? 'year-separator' : ''} ${isGroupSeparator ? 'group-separator' : ''}`}
                  >
                    <div className="section-info">
                      <div className="section-id">{section.sectionID}</div>
                      <div className="section-details">
                        {section.groupID} - Year {section.year}
                      </div>
                    </div>
                  </th>
                );
              })}
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

                      {(() => {
                        const cells = [];
                        let skipNext = 0;

                        sectionData.forEach(({ section, sessionMap, occupiedSlots }, sectionIdx) => {
                          if (skipNext > 0) {
                            skipNext--;
                            return;
                          }

                          if (occupiedSlots.has(slotIndex)) {
                            return;
                          }

                          const session = sessionMap[slotIndex];
                          const isYearSeparator = sectionIdx < filteredSections.length - 1 && 
                            needsSeparator(section, filteredSections[sectionIdx + 1], 'year');
                          const isGroupSeparator = sectionIdx < filteredSections.length - 1 && 
                            needsSeparator(section, filteredSections[sectionIdx + 1], 'group');

                          if (session) {
                            // Check for identical sessions in consecutive sections
                            let colSpan = 1;
                            for (let i = sectionIdx + 1; i < sectionData.length; i++) {
                              const nextSession = sectionData[i].sessionMap[slotIndex];
                              if (areSessionsIdentical(session, nextSession)) {
                                colSpan++;
                                skipNext++;
                              } else {
                                break;
                              }
                            }

                            const lastSectionInMerge = sectionIdx + colSpan - 1;
                            const isMergedYearSeparator = lastSectionInMerge < filteredSections.length - 1 && 
                              needsSeparator(filteredSections[lastSectionInMerge], filteredSections[lastSectionInMerge + 1], 'year');
                            const isMergedGroupSeparator = lastSectionInMerge < filteredSections.length - 1 && 
                              needsSeparator(filteredSections[lastSectionInMerge], filteredSections[lastSectionInMerge + 1], 'group');

                            cells.push(
                              <td
                                key={`${section.sectionID}-${slotIndex}`}
                                rowSpan={session.duration}
                                colSpan={colSpan}
                                className={`session-cell ${session.type.toLowerCase()} ${isMergedYearSeparator ? 'year-separator' : ''} ${isMergedGroupSeparator ? 'group-separator' : ''}`}
                              >
                                <div className="session-content">
                                  <div className="course-code">{session.courseID}</div>
                                  <div className="course-name">{session.courseName}</div>
                                  <div className="instructor">{session.instructorName}</div>
                                  <div className="room">{session.roomID}</div>
                                </div>
                              </td>
                            );
                          } else {
                            cells.push(
                              <td
                                key={`${section.sectionID}-${slotIndex}`}
                                className={`empty-cell ${isYearSeparator ? 'year-separator' : ''} ${isGroupSeparator ? 'group-separator' : ''}`}
                              >
                              </td>
                            );
                          }
                        });

                        return cells;
                      })()}
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
        <p>Loading timetable...</p>
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
                Export
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
                      onClick={handlePrint}
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
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      Print
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