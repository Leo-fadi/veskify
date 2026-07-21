import { DesignSkillRegistry } from "./registry";
import {
  addCampaignSectionSkill,
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  applyMinimalNordicStorefrontStyleSkill,
  applyWarmPremiumStorefrontStyleSkill,
  improveHeroSkill,
} from "./skills";

export const designSkillRegistry = new DesignSkillRegistry([
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  addCampaignSectionSkill,
  improveHeroSkill,
  applyWarmPremiumStorefrontStyleSkill,
  applyMinimalNordicStorefrontStyleSkill,
]);
