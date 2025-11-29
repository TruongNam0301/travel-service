import { DataSource } from "typeorm";
import { readFileSync } from "fs";
import { join } from "path";
import { JobType } from "../src/features/jobs/entities/job-type.entity";
import { PromptTemplate } from "../src/domain/prompt-templates/entities/prompt-template.entity";

/**
 * Seed script to load Handlebars prompt templates into database
 *
 * Usage: ts-node scripts/seed-prompts.ts
 * or: npm run seed:prompts (if script is added to package.json)
 */

const JOB_TYPES = [
  { name: "research_hotel", templateFile: "research_hotel.hbs" },
  { name: "find_food", templateFile: "find_food.hbs" },
  { name: "find_attraction", templateFile: "find_attraction.hbs" },
] as const;

async function seedPrompts() {
  // Create DataSource using the same config as the app
  const dataSource = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "travel_db",
    entities: [JobType, PromptTemplate],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log("Database connection established");

    const jobTypeRepository = dataSource.getRepository(JobType);
    const promptTemplateRepository = dataSource.getRepository(PromptTemplate);

    const promptsDir = join(__dirname, "..", "documents", "prompts");

    for (const { name, templateFile } of JOB_TYPES) {
      console.log(`\nProcessing ${name}...`);

      // Load or create JobType
      let jobType = await jobTypeRepository.findOne({ where: { name } });

      if (!jobType) {
        console.log(`  Creating job type: ${name}`);
        jobType = jobTypeRepository.create({
          name,
          isActive: true,
          description: `Job type for ${name}`,
        });
        jobType = await jobTypeRepository.save(jobType);
      } else {
        console.log(`  Job type already exists: ${name}`);
      }

      // Read template file
      const templatePath = join(promptsDir, templateFile);
      let templateContent: string;

      try {
        templateContent = readFileSync(templatePath, "utf-8");
        console.log(`  Loaded template from: ${templateFile}`);
      } catch (error) {
        console.error(`  ERROR: Could not read template file: ${templatePath}`);
        console.error(
          `  Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        continue;
      }

      // Check if template already exists for this job type
      const existingTemplate = await promptTemplateRepository.findOne({
        where: {
          jobTypeId: jobType.id,
          version: 1,
          isActive: true,
        },
      });

      if (existingTemplate) {
        // Update existing template
        console.log(`  Updating existing template (version 1)`);
        existingTemplate.template = templateContent;
        existingTemplate.updatedAt = new Date();
        await promptTemplateRepository.save(existingTemplate);
        console.log(`  ✓ Template updated`);
      } else {
        // Create new template
        console.log(`  Creating new template (version 1)`);
        const newTemplate = promptTemplateRepository.create({
          jobTypeId: jobType.id,
          template: templateContent,
          version: 1,
          isActive: true,
        });
        await promptTemplateRepository.save(newTemplate);
        console.log(`  ✓ Template created`);
      }
    }

    console.log("\n✓ Seed completed successfully!");
  } catch (error) {
    console.error("ERROR during seed:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log("Database connection closed");
  }
}

// Run seed if executed directly
if (require.main === module) {
  seedPrompts().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { seedPrompts };
