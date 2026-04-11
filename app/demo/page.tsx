'use client';

import { useState, useEffect } from 'react';
import { Worksite, AttendanceSession, Assignment } from '../../types';
import { haversine } from '../../utils/distance';

export default function DemoEmployeePage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('550e8400-e29b-41d4-a716-446655440000');
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [assignedWorksites, setAssignedWorksites] = useState<Worksite[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Get location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        console.log('Location obtained:', position.coords);
      },
      (err) => {
        console.log('Location error:', err.message);
      }
    );
  }, []);

  // Fetch data when employee changes
  useEffect(() => {
    fetchData();
  }, [selectedEmployee]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch worksites
      const wsRes = await fetch('/api/worksites');
      const ws = await wsRes.json();
      setWorksites(ws);

      // Fetch assignments
      const asgnRes = await fetch(`/api/assignments?employeeId=${selectedEmployee}&date=${today}`);
      const asgn = await asgnRes.json();
      const assigned = ws.filter((w: Worksite) => asgn.worksite_ids?.includes(w.id));
      setAssignedWorksites(assigned);

      // Fetch attendance
      const attRes = await fetch(`/api/attendance?employeeId=${selectedEmployee}&date=${today}`);
      const att = await attRes.json();
      setAttendance(att);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleCheckIn = async (worksite: Worksite) => {
    if (!location) {
      alert('Please enable location services');
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          worksiteId: worksite.id,
          checkInTime: new Date().toISOString(),
          location: { lat: location.lat, lng: location.lng },
        }),
      });

      if (res.ok) {
        alert('Check-in successful!');
        fetchData();
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Check-in failed');
    }
  };

  const handleCheckOut = async (session: AttendanceSession) => {
    if (!location) {
      alert('Please enable location services');
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          checkOutTime: new Date().toISOString(),
          location: { lat: location.lat, lng: location.lng },
        }),
      });

      if (res.ok) {
        alert('Check-out successful!');
        fetchData();
      }
    } catch (error) {
      console.error('Check-out failed:', error);
      alert('Check-out failed');
    }
  };

  const getNearbyWorksites = () => {
    if (!location) return [];
    return assignedWorksites.filter((w) => {
      const dist = haversine(location.lat, location.lng, Number(w.latitude), Number(w.longitude));
      return dist <= Number(w.entryRadius);
    });
  };

  const nearby = getNearbyWorksites();
  const activeSession = attendance.find((s) => !s.checkOutTime);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Dashboard (Demo)</h1>
          <p className="text-gray-600">Testing without authentication required</p>
        </div>

        {/* Location Status */}
        <div className={`rounded-lg p-4 mb-6 ${location ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className="text-sm font-semibold">
            {location ? (
              <>📍 Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</>
            ) : (
              <>⏳ Getting your location...</>
            )}
          </p>
        </div>

        {/* Employee Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee:</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="550e8400-e29b-41d4-a716-446655440000">John Doe (Test Employee)</option>
            <option value="550e8400-e29b-41d4-a716-446655440001">Admin User</option>
          </select>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Active Session */}
            {activeSession && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <h2 className="font-bold text-green-900 mb-3">✅ Active Check-In</h2>
                <p className="text-sm text-green-800 mb-3">
                  Started: {new Date(activeSession.checkInTime).toLocaleString()}
                </p>
                <button
                  onClick={() => handleCheckOut(activeSession)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-semibold"
                >
                  Check Out
                </button>
              </div>
            )}

            {/* Nearby Worksites */}
            {nearby.length > 0 && !activeSession && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h2 className="font-bold text-blue-900 mb-3">🎯 Nearby Worksites</h2>
                {nearby.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleCheckIn(w)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold mb-2"
                  >
                    Check In to {w.name}
                  </button>
                ))}
              </div>
            )}

            {/* Assigned Worksites */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4">📍 Assigned Worksites</h2>
              {assignedWorksites.length === 0 ? (
                <p className="text-gray-500">No worksites assigned for today</p>
              ) : (
                <div className="space-y-3">
                  {assignedWorksites.map((w) => (
                    <div key={w.id} className="border border-gray-200 rounded p-3">
                      <p className="font-semibold text-gray-900">{w.name}</p>
                      <p className="text-sm text-gray-600">{w.address}</p>
                      <p className="text-xs text-gray-500">📍 {w.latitude}, {w.longitude}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today's Sessions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4">📊 Today's Attendance</h2>
              {attendance.length === 0 ? (
                <p className="text-gray-500">No attendance records for today</p>
              ) : (
                <div className="space-y-3">
                  {attendance.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded p-3">
                      <div className="flex justify-between items-start">
                        <div >
                          <p className="font-semibold text-gray-900">Worksite #{s.worksiteId}</p>
                          <p className="text-sm text-gray-600">
                            Check-in: {new Date(s.checkInTime).toLocaleTimeString()}
                          </p>
                          {s.checkOutTime && (
                            <p className="text-sm text-gray-600">
                              Check-out: {new Date(s.checkOutTime).toLocaleTimeString()}
                            </p>
                          )}
                          {s.durationMinutes && (
                            <p className="text-sm text-green-600 font-semibold">
                              Duration: {s.durationMinutes} minutes
                            </p>
                          )}
                        </div>
                        {s.checkOutTime ? (
                          <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs font-semibold">Completed</span>
                        ) : (
                          <span className="bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-semibold">Active</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
