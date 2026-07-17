import { DesignSkillRegistry } from "./registry";
import {
  addCampaignSectionSkill,
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  improveHeroSkill,
} from "./skills";

export const designSkillRegistry = new DesignSkillRegistry([
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  addCampaignSectionSkill,
  improveHeroSkill,
]);
