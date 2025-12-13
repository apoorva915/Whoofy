import prisma from '@/config/database';
import { Campaign, CreateCampaignInput, UpdateCampaignInput } from '@/types/campaign';
import { NotFoundError, DatabaseError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Campaign Model - CRUD Operations
 */
export const CampaignModel = {
  /**
   * Create a new campaign
   */
  async create(data: CreateCampaignInput): Promise<Campaign> {
    try {
      const campaign = await prisma.campaign.create({
        data: {
          ...data,
          requirements: data.requirements as any,
          startDate: typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate,
          endDate: typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate,
        },
      });
      
      logger.info(`Campaign created: ${campaign.id}`);
      return this.mapToCampaign(campaign);
    } catch (error) {
      logger.error('Error creating campaign:', error);
      throw new DatabaseError('Failed to create campaign', error);
    }
  },

  /**
   * Find campaign by ID
   */
  async findById(id: string): Promise<Campaign | null> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id },
      });
      
      return campaign ? this.mapToCampaign(campaign) : null;
    } catch (error) {
      logger.error('Error finding campaign:', error);
      throw new DatabaseError('Failed to find campaign', error);
    }
  },

  /**
   * Find campaign by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Campaign> {
    const campaign = await this.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campaign', id);
    }
    return campaign;
  },

  /**
   * Find all campaigns with pagination
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    status?: string;
    brandId?: string;
  } = {}): Promise<{ campaigns: Campaign[]; total: number }> {
    try {
      const { page = 1, limit = 20, status, brandId } = options;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (brandId) where.brandId = brandId;

      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.campaign.count({ where }),
      ]);

      return {
        campaigns: campaigns.map(this.mapToCampaign),
        total,
      };
    } catch (error) {
      logger.error('Error finding campaigns:', error);
      throw new DatabaseError('Failed to find campaigns', error);
    }
  },

  /**
   * Update campaign
   */
  async update(id: string, data: UpdateCampaignInput): Promise<Campaign> {
    try {
      const updateData: any = { ...data };
      
      if (data.requirements) {
        updateData.requirements = data.requirements as any;
      }
      
      if (data.startDate) {
        updateData.startDate = typeof data.startDate === 'string' 
          ? new Date(data.startDate) 
          : data.startDate;
      }
      
      if (data.endDate) {
        updateData.endDate = typeof data.endDate === 'string' 
          ? new Date(data.endDate) 
          : data.endDate;
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Campaign updated: ${id}`);
      return this.mapToCampaign(campaign);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Campaign', id);
      }
      logger.error('Error updating campaign:', error);
      throw new DatabaseError('Failed to update campaign', error);
    }
  },

  /**
   * Delete campaign
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.campaign.delete({
        where: { id },
      });
      logger.info(`Campaign deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Campaign', id);
      }
      logger.error('Error deleting campaign:', error);
      throw new DatabaseError('Failed to delete campaign', error);
    }
  },

  /**
   * Map Prisma model to Campaign type
   */
  mapToCampaign(campaign: any): Campaign {
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      brandName: campaign.brandName,
      title: campaign.title,
      description: campaign.description || undefined,
      requirements: campaign.requirements,
      status: campaign.status as any,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  },
};
