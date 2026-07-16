import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventsWithStats, getCurrentUser, signOut, isDropboxConnected, getDropboxAuthUrl } from '../../lib/planner';

interface EventWithStats {
  id: string;
  name: string;
  start_time: string;
  end_time: string | null;
  status: string;
  created_at: string;
  session_count: number;
  media_count: number;
  shared_count: number;
}

export function PlannerDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/planner/login');
        return;
      }

      setUserId(user.id);
      const [eventsData, dbxConnected] = await Promise.all([
        getEventsWithStats(),
        isDropboxConnected(),
      ]);

      setEvents(eventsData);
      setDropboxConnected(dbxConnected);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/planner/login');
  };

  const connectDropbox = () => {
    if (userId) {
      window.location.href = getDropboxAuthUrl(userId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Event Candid Capture</h1>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold">Your Events</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {!dropboxConnected && (
              <button
                onClick={connectDropbox}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2l6 3.75L6 9.5 0 5.75zm12 0l6 3.75-6 3.75-6-3.75zm-12 11l6-3.75L18 13l-6 3.75zm12 0l6-3.75-6-3.75zM6 15.25l6-3.75 6 3.75-6 3.75z"/>
                </svg>
                Connect Dropbox
              </button>
            )}
            <button
              onClick={() => navigate('/planner/events/create')}
              className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200"
            >
              Create Event
            </button>
          </div>
        </div>

        {!dropboxConnected && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-yellow-200 text-sm">
              Connect your Dropbox account so guests can share photos directly to your folders.
            </p>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No events yet</p>
            <p className="text-gray-500 mt-2">Create your first event to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/planner/events/${event.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <h3 className="font-semibold text-lg truncate">{event.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          event.status === 'active'
                            ? 'bg-green-900/50 text-green-300'
                            : event.status === 'ended'
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {new Date(event.start_time).toLocaleDateString()} &middot;{' '}
                      {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex gap-4 text-center sm:ml-4">
                    <div>
                      <p className="text-xl font-bold">{event.session_count}</p>
                      <p className="text-xs text-gray-500">Guests</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{event.media_count}</p>
                      <p className="text-xs text-gray-500">Media</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-400">{event.shared_count}</p>
                      <p className="text-xs text-gray-500">Shared</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
