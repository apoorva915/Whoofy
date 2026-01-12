import { NextRequest, NextResponse } from 'next/server';

// Individual creator routes
// GET /api/creators/[id] - Get creator details
// PUT /api/creators/[id] - Update creator

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
