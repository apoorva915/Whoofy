import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import logger from '@/utils/logger';

/**
 * GET /api/frames
 * Serve frame images
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const framePath = searchParams.get('path');

    if (!framePath) {
      return new NextResponse('Path parameter required', { status: 400 });
    }

    // Security: Only allow frames from storage directory
    const storageDir = path.join(process.cwd(), 'storage', 'frames');
    
    // Handle both absolute and relative paths
    let fullPath: string;
    
    // On Windows, paths starting with / are treated as absolute from drive root
    // So we need to handle /storage/ paths specially
    if (framePath.startsWith('/storage/')) {
      // Remove leading / and join with cwd to get proper absolute path
      const relativePath = framePath.substring(1); // Remove leading /
      fullPath = path.join(process.cwd(), relativePath);
    } else if (framePath.startsWith('storage/')) {
      fullPath = path.join(process.cwd(), framePath);
    } else if (path.isAbsolute(framePath)) {
      fullPath = framePath;
    } else {
      // Assume it's a filename in the frames directory
      fullPath = path.join(process.cwd(), 'storage', 'frames', framePath);
    }
    
    // Normalize the path to handle any .. or . segments
    fullPath = path.normalize(fullPath);

    // Normalize paths for comparison
    const normalizedFullPath = path.normalize(fullPath);
    const normalizedStorageDir = path.normalize(storageDir);

    const isWithinStorage = process.platform === 'win32'
      ? normalizedFullPath.toLowerCase().startsWith(normalizedStorageDir.toLowerCase())
      : normalizedFullPath.startsWith(normalizedStorageDir);

    if (!isWithinStorage) {
      logger.warn({ 
        framePath, 
        fullPath, 
        resolvedFullPath: normalizedFullPath,
        storageDir, 
        resolvedStorageDir: normalizedStorageDir,
        comparison: normalizedFullPath.toLowerCase().substring(0, 50),
        storageStart: normalizedStorageDir.toLowerCase().substring(0, 50),
        platform: process.platform
      }, 'Frame path validation failed');
      return new NextResponse(`Invalid path: ${framePath}`, { status: 403 });
    }

    // Check if file exists
    if (!(await fs.pathExists(fullPath))) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Read and serve image
    const imageBuffer = await fs.readFile(fullPath);
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new NextResponse('Error serving frame', { status: 500 });
  }
}

