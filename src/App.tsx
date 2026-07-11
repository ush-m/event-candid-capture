import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EventCapture } from './pages/EventCapture';
import { ReviewPage } from './pages/review/ReviewPage';
import { PlannerLogin } from './pages/planner/PlannerLogin';
import { PlannerSignup } from './pages/planner/PlannerSignup';
import { PlannerDashboard } from './pages/planner/PlannerDashboard';
import { CreateEvent } from './pages/planner/CreateEvent';
import { EventDetail } from './pages/planner/EventDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/event/:eventId" element={<EventCapture />} />
        <Route path="/review/:token" element={<ReviewPage />} />
        <Route path="/planner/login" element={<PlannerLogin />} />
        <Route path="/planner/signup" element={<PlannerSignup />} />
        <Route path="/planner/dashboard" element={<PlannerDashboard />} />
        <Route path="/planner/events/create" element={<CreateEvent />} />
        <Route path="/planner/events/:eventId" element={<EventDetail />} />
        <Route path="/" element={
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
            <div className="text-center space-y-6">
              <h1 className="text-3xl font-bold">Event Candid Capture</h1>
              <p className="text-gray-400">Scan the QR code at your event to get started.</p>
              <a
                href="/planner/login"
                className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Planner Login
              </a>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
