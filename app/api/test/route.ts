import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      dbHost: process.env.DB_HOST,
      dbPort: process.env.DB_PORT,
      dbName: process.env.DB_NAME,
      dbUser: process.env.DB_USER,
    },
    results: {}
  };

  try {
    // Test 1: Database connection
    console.log('TEST: Checking database connection...');
    const dbTest = await queryDB('SELECT NOW()');
    diagnostics.results.database = { status: 'ok', message: 'Connected to database' };
    console.log('TEST: Database connection OK');
  } catch (error: any) {
    diagnostics.results.database = { status: 'error', message: error.message };
    console.error('TEST: Database connection failed:', error.message);
  }

  try {
    // Test 2: Count employees
    console.log('TEST: Counting employees...');
    const empCount = await queryDB('SELECT COUNT(*) as count FROM employees');
    diagnostics.results.employees = { 
      status: 'ok', 
      count: empCount.rows[0].count 
    };
    console.log('TEST: Employee count:', empCount.rows[0].count);
  } catch (error: any) {
    diagnostics.results.employees = { status: 'error', message: error.message };
  }

  try {
    // Test 3: Count worksites
    console.log('TEST: Counting worksites...');
    const wsCount = await queryDB('SELECT COUNT(*) as count FROM worksites');
    diagnostics.results.worksites = { 
      status: 'ok', 
      count: wsCount.rows[0].count 
    };
    console.log('TEST: Worksite count:', wsCount.rows[0].count);
  } catch (error: any) {
    diagnostics.results.worksites = { status: 'error', message: error.message };
  }

  try {
    // Test 4: Count assignments
    console.log('TEST: Counting assignments...');
    const asgnCount = await queryDB('SELECT COUNT(*) as count FROM assignments');
    diagnostics.results.assignments = { 
      status: 'ok', 
      count: asgnCount.rows[0].count 
    };
    console.log('TEST: Assignment count:', asgnCount.rows[0].count);
  } catch (error: any) {
    diagnostics.results.assignments = { status: 'error', message: error.message };
  }

  return NextResponse.json(diagnostics);
}
