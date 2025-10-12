import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout/Layout';
import Courses from './pages/Courses';
import Instructors from './pages/Instructors';
import Rooms from './pages/Rooms';
import Sections from './pages/Sections';
import Groups from './pages/Groups';
import TimetableView from './pages/TimetableView';
import Ta from './pages/Ta';
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/" element={<TimetableView />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/instructors" element={<Instructors />} />
              <Route path="/ta" element={<Ta />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/sections" element={<Sections />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/timetable/:id" element={<TimetableView />} />
              <Route path="/timetable" element={<TimetableView />} />
            </Routes>
          </Layout>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
