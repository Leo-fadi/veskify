import { DesignSkillRegistry } from "./registry";
import {
  addCampaignSectionSkill,
  applyExactBrandPaletteSkill,
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  applyMinimalNordicStorefrontStyleSkill,
  applyRegisteredWholeStorefrontDirectionSkill,
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
  applyRegisteredWholeStorefrontDirectionSkill,
]);
