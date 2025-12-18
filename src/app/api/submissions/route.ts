import { NextRequest, NextResponse } from 'next/server';

// Submission management routes
// GET /api/submissions - List submissions
// POST /api/submissions - Create submission

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
