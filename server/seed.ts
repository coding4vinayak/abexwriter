import { storage } from "./storage";
import { log } from "./vite";

// Default achievements to seed the database
const defaultAchievements = [
  {
    name: "First Words",
    description: "Write your first 100 words",
    type: "word_count" as const,
    threshold: 100,
    icon: "award"
  },
  {
    name: "Dedicated Writer",
    description: "Write at least 1,000 words total",
    type: "word_count" as const,
    threshold: 1000,
    icon: "award"
  },
  {
    name: "Prolific Author",
    description: "Write at least 10,000 words total",
    type: "word_count" as const,
    threshold: 10000,
    icon: "award"
  },
  {
    name: "First Streak",
    description: "Write for 3 consecutive days",
    type: "streak" as const,
    threshold: 3,
    icon: "calendar-clock"
  },
  {
    name: "Consistent Writer",
    description: "Write for 7 consecutive days",
    type: "streak" as const,
    threshold: 7,
    icon: "calendar-clock"
  },
  {
    name: "Writing Machine",
    description: "Write for 30 consecutive days",
    type: "streak" as const,
    threshold: 30,
    icon: "calendar-clock"
  },
  {
    name: "First Chapter",
    description: "Complete your first chapter",
    type: "chapter_completion" as const,
    threshold: 1,
    icon: "flag"
  },
  {
    name: "Chapter Master",
    description: "Complete 10 chapters across all your books",
    type: "chapter_completion" as const,
    threshold: 10,
    icon: "flag"
  },
  {
    name: "First Book",
    description: "Create your first book",
    type: "first_book" as const,
    threshold: 1,
    icon: "star"
  },
  {
    name: "Finished Book",
    description: "Complete your first book",
    type: "book_completion" as const,
    threshold: 1,
    icon: "trophy"
  }
];

// Seed achievements
export async function seedAchievements() {
  try {
    // Get existing achievements
    const existingAchievements = await storage.getAchievements();
    
    if (existingAchievements.length === 0) {
      log("Seeding achievements...");
      
      // Add each achievement
      for (const achievement of defaultAchievements) {
        await storage.createAchievement(achievement);
      }
      
      log(`Successfully seeded ${defaultAchievements.length} achievements`);
    } else {
      log(`Achievements already exist, skipping seeding (${existingAchievements.length} found)`);
    }
  } catch (error) {
    log(`Error seeding achievements: ${error}`);
  }
}

// Seed default LLM settings
export async function seedDefaultLlmSettings() {
  try {
    // Get existing LLM settings
    const existingSettings = await storage.getAllLlmSettings();
    
    // Check if default settings exist
    const defaultSettings = await storage.getDefaultLlmSettings().catch(() => null);
    
    if (!defaultSettings) {
      // If settings already exist but none are marked as default
      if (existingSettings.length > 0) {
        // Find the "novi" settings
        const noviSettings = existingSettings.find(s => s.name === "novi");
        
        if (noviSettings) {
          log("Setting 'novi' as the default LLM settings");
          // Update to make it the default
          await storage.updateLlmSettings(noviSettings.id, { isDefault: true });
          log("Successfully set 'novi' as the default LLM settings");
          return;
        }
      }
      
      // If no settings exist or "novi" settings don't exist
      log("Creating default LLM settings");
      
      // Create Novi DeepSeek model settings
      const noviLlmSettings = {
        name: "novi",
        model: "deepseek" as const,
        customModelUrl: null,
        apiKey: null,
        temperature: 0.5, // Lower temperature for better grammar
        maxTokens: 2000,  // More tokens for longer chapters
        topP: 0.9,
        presencePenalty: 0.1,
        isDefault: true
      };
      
      await storage.createLlmSettings(noviLlmSettings);
      log("Successfully created default LLM settings");
    } else {
      log("Default LLM settings already exist, skipping seeding");
    }
  } catch (error) {
    log(`Error seeding default LLM settings: ${error}`);
  }
}