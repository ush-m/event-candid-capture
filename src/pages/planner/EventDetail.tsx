import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getEvent, getEventStats, getEventGuests, endEvent, updateEvent } from '../../lib/planner';

interface EventData {
  id: string;
  name: string;
  start_time: string;
  end_time: string | null;
  status: string;
  reminder_buffer_minutes: number;
  retention_days: number;
}

interface Stats {
  total_sessions: number;
  completed_sessions: number;
  response_rate: number;
  total_media: number;
  staged_media: number;
  shared_media: number;
}

interface Guest {
  id: string;
  contact_method: string;
  contact_value: string;
  created_at: string;
  reminder_sent_at: string | null;
  selection_completed_at: string | null;
  total_media: number;
  shared_media: number;
  delivered_media: number;
  failed_media: number;
  status: 'completed' | 'reminded' | 'pending';
}

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (eventId) loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    try {
      const [eventData, statsData, guestsData] = await Promise.all([
        getEvent(eventId),
        getEventStats(eventId),
        getEventGuests(eventId),
      ]);
      setEvent(eventData);
      setStats(statsData.stats);
      setGuests(guestsData.guests);
      setEditName(eventData.name);
    } catch (err) {
      console.error('Failed to load event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEndEvent = async () => {
    if (!eventId || !confirm('End this event and send reminders to all guests?')) return;
    setEnding(true);
    try {
      await endEvent(eventId);
      await loadEvent();
    } catch (err) {
      console.error('Failed to end event:', err);
    } finally {
      setEnding(false);
    }
  };

  const handleSaveName = async () => {
    if (!eventId || !editName.trim()) return;
    try {
      await updateEvent(eventId, { name: editName.trim() });
      setEditing(false);
      await loadEvent();
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  };

  const getEventUrl = () => `${window.location.origin}/event/${eventId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getEventUrl());
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector('#qr-code svg') as SVGElement;
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${event?.name.replace(/[^a-zA-Z0-9]/g, '_') || 'event'}_qr.png`;
      a.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/planner/dashboard')}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Event Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-3 py-1 bg-white text-black rounded-lg text-sm font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 bg-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{event.name}</h1>
                <button
                  onClick={() => setEditing(true)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-gray-400 mt-1">
              {new Date(event.start_time).toLocaleDateString()} &middot;{' '}
              {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              event.status === 'active'
                ? 'bg-green-900/50 text-green-300'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {event.status}
          </span>
        </div>

        {/* QR Code Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-semibold mb-3">Guest Access</h2>
              <div className="flex items-center gap-3">
                <input
                  readOnly
                  value={getEventUrl()}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
                >
                  {showQR ? 'Hide QR' : 'Show QR'}
                </button>
              </div>
            </div>
          </div>

          {showQR && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div id="qr-code" className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={getEventUrl()}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <button
                onClick={handleDownloadQR}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
              >
                Download QR Code
              </button>
              <p className="text-gray-500 text-sm text-center">
                Print this QR code and display at your event entrance
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{stats.total_sessions}</p>
              <p className="text-gray-400 text-sm mt-1">Total Scans</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{stats.response_rate}%</p>
              <p className="text-gray-400 text-sm mt-1">Response Rate</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{stats.total_media}</p>
              <p className="text-gray-400 text-sm mt-1">Total Media</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{stats.shared_media}</p>
              <p className="text-gray-400 text-sm mt-1">Shared</p>
            </div>
          </div>
        )}

        {/* Guest List */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-4">Guest List ({guests.length})</h2>
          
          {guests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No guests yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2 px-3">Contact</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-center py-2 px-3">Media</th>
                    <th className="text-center py-2 px-3">Shared</th>
                    <th className="text-center py-2 px-3">Delivered</th>
                    <th className="text-left py-2 px-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest) => (
                    <tr key={guest.id} className="border-b border-gray-800/50">
                      <td className="py-2 px-3">
                        <span className="text-gray-500 text-xs">{guest.contact_method === 'phone' ? '📱' : '📧'}</span>
                        <span className="ml-2">{guest.contact_value}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          guest.status === 'completed'
                            ? 'bg-green-900/50 text-green-300'
                            : guest.status === 'reminded'
                            ? 'bg-yellow-900/50 text-yellow-300'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {guest.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">{guest.total_media}</td>
                      <td className="py-2 px-3 text-center">{guest.shared_media}</td>
                      <td className="py-2 px-3 text-center">
                        {guest.delivered_media > 0 && (
                          <span className="text-green-400">{guest.delivered_media}</span>
                        )}
                        {guest.failed_media > 0 && (
                          <span className="text-red-400 ml-1">({guest.failed_media} failed)</span>
                        )}
                        {guest.delivered_media === 0 && guest.failed_media === 0 && '-'}
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        {new Date(guest.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {event.status === 'active' && (
            <button
              onClick={handleEndEvent}
              disabled={ending}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50"
            >
              {ending ? 'Ending...' : 'End Event & Send Reminders'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
