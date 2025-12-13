import prisma from '@/config/database';
import { Creator, CreateCreatorInput, UpdateCreatorInput } from '@/types/creator';
import { NotFoundError, DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Creator Model - CRUD Operations
 */
export const CreatorModel = {
  /**
   * Create a new creator
   */
  async create(data: CreateCreatorInput): Promise<Creator> {
    try {
      const creator = await prisma.creator.create({
        data: {
          ...data,
          niche: data.niche as any,
          language: data.language as any,
        },
      });
      
      logger.info(`Creator created: ${creator.id}`);
      return this.mapToCreator(creator);
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new DatabaseError('Creator with this Instagram handle or ID already exists');
      }
      logger.error('Error creating creator:', error);
      throw new DatabaseError('Failed to create creator', error);
    }
  },

  /**
   * Find creator by ID
   */
  async findById(id: string): Promise<Creator | null> {
    try {
      const creator = await prisma.creator.findUnique({
        where: { id },
      });
      
      return creator ? this.mapToCreator(creator) : null;
    } catch (error) {
      logger.error('Error finding creator:', error);
      throw new DatabaseError('Failed to find creator', error);
    }
  },

  /**
   * Find creator by Instagram handle
   */
  async findByInstagramHandle(handle: string): Promise<Creator | null> {
    try {
      const creator = await prisma.creator.findUnique({
        where: { instagramHandle: handle },
      });
      
      return creator ? this.mapToCreator(creator) : null;
    } catch (error) {
      logger.error('Error finding creator by handle:', error);
      throw new DatabaseError('Failed to find creator', error);
    }
  },

  /**
   * Find creator by Instagram ID
   */
  async findByInstagramId(instagramId: string): Promise<Creator | null> {
    try {
      const creator = await prisma.creator.findFirst({
        where: { instagramId },
      });
      
      return creator ? this.mapToCreator(creator) : null;
    } catch (error) {
      logger.error('Error finding creator by Instagram ID:', error);
      throw new DatabaseError('Failed to find creator', error);
    }
  },

  /**
   * Find creator by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Creator> {
    const creator = await this.findById(id);
    if (!creator) {
      throw new NotFoundError('Creator', id);
    }
    return creator;
  },

  /**
   * Find all creators with pagination
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    minFollowers?: number;
    niche?: string[];
  } = {}): Promise<{ creators: Creator[]; total: number }> {
    try {
      const { page = 1, limit = 20, minFollowers, niche } = options;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (minFollowers) {
        where.followerCount = { gte: minFollowers };
      }
      if (niche && niche.length > 0) {
        where.niche = { hasSome: niche };
      }

      const [creators, total] = await Promise.all([
        prisma.creator.findMany({
          where,
          skip,
          take: limit,
          orderBy: { followerCount: 'desc' },
        }),
        prisma.creator.count({ where }),
      ]);

      return {
        creators: creators.map(this.mapToCreator),
        total,
      };
    } catch (error) {
      logger.error('Error finding creators:', error);
      throw new DatabaseError('Failed to find creators', error);
    }
  },

  /**
   * Update creator
   */
  async update(id: string, data: UpdateCreatorInput): Promise<Creator> {
    try {
      const updateData: any = { ...data };
      
      if (data.niche) {
        updateData.niche = data.niche as any;
      }
      
      if (data.language) {
        updateData.language = data.language as any;
      }

      const creator = await prisma.creator.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Creator updated: ${id}`);
      return this.mapToCreator(creator);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Creator', id);
      }
      logger.error('Error updating creator:', error);
      throw new DatabaseError('Failed to update creator', error);
    }
  },

  /**
   * Delete creator
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.creator.delete({
        where: { id },
      });
      logger.info(`Creator deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Creator', id);
      }
      logger.error('Error deleting creator:', error);
      throw new DatabaseError('Failed to delete creator', error);
    }
  },

  /**
   * Map Prisma model to Creator type
   */
  mapToCreator(creator: any): Creator {
    return {
      id: creator.id,
      instagramHandle: creator.instagramHandle,
      instagramId: creator.instagramId,
      displayName: creator.displayName,
      followerCount: creator.followerCount,
      followingCount: creator.followingCount,
      postCount: creator.postCount,
      niche: creator.niche as any,
      gender: creator.gender as any,
      age: creator.age,
      location: creator.location,
      language: creator.language as any,
      profilePictureUrl: creator.profilePictureUrl,
      bio: creator.bio,
      isVerified: creator.isVerified,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };
  },
};
