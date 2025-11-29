import { Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Logger } from "@nestjs/common";
import databaseConfig from "../../config/database.config";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (
        dbCfg: ConfigType<typeof databaseConfig>,
      ): TypeOrmModuleOptions => ({
        type: "postgres",
        host: dbCfg.host,
        port: dbCfg.port,
        username: dbCfg.username,
        password: dbCfg.password,
        database: dbCfg.database,
        synchronize: dbCfg.synchronize,
        logging: dbCfg.logging,
        autoLoadEntities: true,
        extra: {
          application_name: "travel-service",
        },
      }),
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
        this.logger.log("Database connection closed successfully");
      }
    } catch (error) {
      this.logger.error("Error closing database connection", error);
    }
  }
}
