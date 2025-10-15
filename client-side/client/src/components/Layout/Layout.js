import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Calendar, 
  BookOpen, 
  Users, 
  MapPin, 
  UserCheck, 
  Grid3X3,
} from 'lucide-react';

const Layout = ({ children }) => {
  const navItems = [
    { path: '/courses', label: 'Courses', icon: BookOpen },
    { path: '/instructors', label: 'Instructors', icon: UserCheck },
    { path: '/ta', label: 'TA', icon: UserCheck },
    { path: '/rooms', label: 'Rooms', icon: MapPin },
    { path: '/groups', label: 'Groups', icon: Grid3X3 },
    { path: '/sections', label: 'Sections', icon: Users },
    { path: '/timetable', label: 'View Timetable', icon: Calendar },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="nav-brand">
          <Calendar className="inline-block mr-2" size={24} />
          CSIT Timetable
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
                    {item.label}
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
    </div>
  );
};

export default Layout;
