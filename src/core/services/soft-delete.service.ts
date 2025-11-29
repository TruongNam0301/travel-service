import { Repository, FindOptionsWhere } from "typeorm";

export interface SoftDeletable {
  id: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export class SoftDeleteService<T extends SoftDeletable> {
  constructor(private readonly repository: Repository<T>) {}

  /**
   * Soft delete an entity by marking it as deleted
   */
  async softDelete(id: string, deletedBy: string): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!entity) {
      throw new Error(`Entity with id ${id} not found`);
    }

    entity.isDeleted = true;
    entity.deletedAt = new Date();
    entity.deletedBy = deletedBy;

    return await this.repository.save(entity);
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore(id: string): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!entity) {
      throw new Error(`Entity with id ${id} not found`);
    }

    entity.isDeleted = false;
    entity.deletedAt = undefined;
    entity.deletedBy = undefined;

    return await this.repository.save(entity);
  }

  /**
   * Find all active (non-deleted) entities
   */
  async findAllActive(): Promise<T[]> {
    return await this.repository.find({
      where: { isDeleted: false } as FindOptionsWhere<T>,
    });
  }

  /**
   * Find all deleted entities
   */
  async findAllDeleted(): Promise<T[]> {
    return await this.repository.find({
      where: { isDeleted: true } as FindOptionsWhere<T>,
    });
  }

  /**
   * Find one active entity by ID
   */
  async findOneActive(id: string): Promise<T | null> {
    return await this.repository.findOne({
      where: { id, isDeleted: false } as FindOptionsWhere<T>,
    });
  }
}
