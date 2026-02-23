import { Creator, CreateCreatorInput, UpdateCreatorInput } from '@/types/creator';
import { NotFoundError, DatabaseError } from '@/utils/errors';

/**
 * Creator Model
 *
 * NOTE: The current Prisma schema in this repository does not define a `creator`
 * model/table (it only has `creator_profiles`, etc.). To keep the codebase
 * compiling and avoid runtime mismatch with the database, this model is
 * intentionally implemented as a stub.
 *
 * If any of these methods are called at runtime, they will throw a
 * `DatabaseError` with a clear message.
 */
export const CreatorModel = {
  async create(_data: CreateCreatorInput): Promise<Creator> {
    throw new DatabaseError('CreatorModel is not available in this deployment (no matching Prisma model).');
  },

  async findById(_id: string): Promise<Creator | null> {
    return null;
  },  async findByInstagramHandle(_handle: string): Promise<Creator | null> {
    return null;
  },

  async findByInstagramId(_instagramId: string): Promise<Creator | null> {
    return null;
  },  async findByIdOrThrow(id: string): Promise<Creator> {
    const creator = await this.findById(id);
    if (!creator) {
      throw new NotFoundError('Creator', id);
    }
    return creator;
  },  async findAll(_options: {
    page?: number;
    limit?: number;
    minFollowers?: number;
    niche?: string[];
  } = {}): Promise<{ creators: Creator[]; total: number }> {
    return { creators: [], total: 0 };
  },  async update(_id: string, _data: UpdateCreatorInput): Promise<Creator> {
    throw new DatabaseError('CreatorModel is not available in this deployment (no matching Prisma model).');
  },  async delete(_id: string): Promise<void> {
    // no-op
  },
};
