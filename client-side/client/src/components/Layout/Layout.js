import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import { 
  Calendar, 
  BookOpen, 
  Users, 
  MapPin, 
  UserCheck, 
  Grid3X3,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';

const Layout = ({ children }) => {
  const [timetables, setTimetables] = useState([]);
  const [selectedTimetableID, setSelectedTimetableID] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({ timetableID: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navItems = [
    { path: '/courses', label: 'Courses', icon: BookOpen },
    { path: '/instructors', label: 'Instructors', icon: UserCheck },
    { path: '/ta', label: 'TA', icon: UserCheck },
    { path: '/rooms', label: 'Rooms', icon: MapPin },
    { path: '/groups', label: 'Groups', icon: Grid3X3 },
    { path: '/sections', label: 'Sections', icon: Users },
    { path: '/timetable', label: 'View Timetable', icon: Calendar },
  ];

  useEffect(() => {
    const savedID = localStorage.getItem('selectedTimetableID');
    if (savedID) {
      setSelectedTimetableID(savedID);
    }
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, []);

  const fetchTimetables = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('http://localhost:5000/api/timetables');
      setTimetables(res.data);
    } catch (error) {
      console.error('Error fetching timetables:', error);
      setError('Failed to load timetables');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTimetable = (e) => {
    const id = e.target.value;
    setSelectedTimetableID(id);
    localStorage.setItem('selectedTimetableID', id);
    
    window.location.reload();
  };

  const handleCreate = () => {
    setModalMode('create');
    setFormData({ timetableID: '', name: '' });
    setShowModal(true);
  };

  const handleEdit = () => {
    const selected = timetables.find(t => t.timetableID === selectedTimetableID);
    if (selected) {
      setModalMode('edit');
      setFormData({ timetableID: selected.timetableID, name: selected.name });
      setShowModal(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedTimetableID) return;
    if (!window.confirm('Are you sure you want to delete this timetable?')) return;

    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/timetables/${selectedTimetableID}`);
      localStorage.removeItem('selectedTimetableID');
      setSelectedTimetableID('');
      
      window.location.reload();
    } catch (error) {
      console.error('Error deleting timetable:', error);
      setError('Failed to delete timetable');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      
      if (modalMode === 'create') {
        await axios.post('http://localhost:5000/api/timetables', formData);
      } else {
        await axios.put(
          `http://localhost:5000/api/timetables/${formData.timetableID}`,
          { name: formData.name }
        );
      }

      setShowModal(false);
      setFormData({ timetableID: '', name: '' });
      fetchTimetables();
    } catch (error) {
      console.error('Error saving timetable:', error);
      setError(error.response?.data?.message || 'Failed to save timetable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="nav-brand">
          CSIT Timetable
        </div>

        <div className="tt-selector-container">
          <select
            value={selectedTimetableID}
            onChange={handleSelectTimetable}
            className="tt-selector-dropdown"
            disabled={loading}
          >
            <option value="">Select Timetable</option>
            {timetables.map((tt) => (
              <option key={tt.timetableID} value={tt.timetableID}>
                {tt.name}
              </option>
            ))}
          </select>

          {error && <p className="tt-error-message">{error}</p>}

          <div className="tt-actions-container">
            <button 
              onClick={handleCreate} 
              title="Create" 
              className="tt-action-btn"
              disabled={loading}
            >
              <Plus size={16} />
            </button>
            <button 
              onClick={handleEdit} 
              disabled={!selectedTimetableID || loading}
              title="Edit" 
              className="tt-action-btn"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={handleDelete} 
              disabled={!selectedTimetableID || loading}
              title="Delete" 
              className="tt-action-btn tt-delete-btn"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <nav>
          <ul className="nav-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path} className="nav-item">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      
      <main className="main-content">
        {children}
      </main>

      {showModal && (
        <div className="tt-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tt-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {modalMode === 'create' ? 'Create Timetable' : 'Edit Timetable'}
            </h3>
            <form onSubmit={handleSubmit}>
              {modalMode === 'create' && (
                <div className="tt-form-group">
                  <label htmlFor="timetableID">Timetable ID</label>
                  <input
                    id="timetableID"
                    type="text"
                    value={formData.timetableID}
                    onChange={(e) => 
                      setFormData({ ...formData, timetableID: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>
              )}
              <div className="tt-form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => 
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
              <div className="tt-modal-actions">
                <button type="submit" className="tt-btn-primary" disabled={loading}>
                  {loading ? 'Processing...' : (modalMode === 'create' ? 'Create' : 'Update')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="tt-btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
