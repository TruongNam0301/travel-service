import { Module, OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbConfig = configService.get<TypeOrmModuleOptions>('database')!;
        return {
          ...dbConfig,
          autoLoadEntities: true,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Closing database connection... (signal: ${signal})`);
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.log('Database connection closed successfully');
      }
    } catch (error) {
      this.logger.error('Error closing database connection', error);
    }
  }
}
