import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const response = NextResponse.json({ success: true, message: 'Logged out.' });
  
  // Clear the HTTP-only session cookie
  response.cookies.delete('session');

  return response;
}
