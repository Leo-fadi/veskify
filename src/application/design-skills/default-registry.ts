import { DesignSkillRegistry } from "./registry";
import {
  addCampaignSectionSkill,
  applyExactBrandPaletteSkill,
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
  applyExactBrandPaletteSkill,
  applyWarmPremiumStorefrontStyleSkill,
  applyMinimalNordicStorefrontStyleSkill,
]);
