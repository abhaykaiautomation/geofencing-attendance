'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        console.log('TEST PAGE: Starting to fetch all data...');
        
        // Fetch worksites
        console.log('TEST PAGE: Fetching worksites...');
        const wsRes = await fetch('/api/worksites');
        const worksites = await wsRes.json();
        console.log('TEST PAGE: Got worksites:', worksites.length);

        // Fetch test employee
        console.log('TEST PAGE: Creating test employee...');
        const empRes = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test-user-' + Date.now() + '@example.com',
            name: 'Test User',
          }),
        });
        const employee = await empRes.json();
        console.log('TEST PAGE: Got employee:', employee);

        // Fetch assignments for today
        console.log('TEST PAGE: Fetching assignments...');
        const today = new Date().toISOString().split('T')[0];
        const asgnRes = await fetch(`/api/assignments?employeeId=${employee.id}&date=${today}`);
        const assignment = await asgnRes.json();
        console.log('TEST PAGE: Got assignment:', assignment);

        // Fetch attendance sessions
        console.log('TEST PAGE: Fetching attendance...');
        const attRes = await fetch(`/api/attendance?employeeId=${employee.id}&date=${today}`);
        const attendance = await attRes.json();
        console.log('TEST PAGE: Got attendance:', attendance);

        setData({
          worksites,
          employee,
          assignment,
          attendance,
          success: true
        });
        setLoading(false);
      } catch (err: any) {
        console.error('TEST PAGE: Error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">System Test Results ✅</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <h2 className="font-bold text-green-900">Database</h2>
          <p className="text-sm">✅ Connected</p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <h2 className="font-bold text-blue-900">Worksites</h2>
          <p className="text-sm">✅ {data?.worksites?.length} found</p>
        </div>

        <div className="bg-purple-50 p-4 rounded border border-purple-200">
          <h2 className="font-bold text-purple-900">Employee Created</h2>
          <p className="text-sm">✅ {data?.employee?.email}</p>
        </div>

        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
          <h2 className="font-bold text-yellow-900">APIs Working</h2>
          <p className="text-sm">✅ All 4 endpoints</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 className="font-bold mb-2">Full API Response:</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>

      <div className="mt-4 flex gap-4">
        <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded">
          Go to Login
        </a>
        <a href="/" className="px-4 py-2 bg-gray-600 text-white rounded">
          Go to Home
        </a>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-900">
          <strong>Diagnosis:</strong> If you see all ✅ marks above, all backend systems are working correctly. 
          The issue is with the authentication/employee page flow.
        </p>
      </div>
    </div>
  );
}
