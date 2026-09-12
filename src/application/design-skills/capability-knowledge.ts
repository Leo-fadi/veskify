import { designSkillRegistry } from "./default-registry";
import type { DesignSkillRegistry } from "./registry";
import {
  projectCurrentDesignSkillInventory,
  type CurrentDesignSkillInventoryEntry,
} from "./capability-knowledge-core";

export {
  skillCapabilityKnowledgeErrorCodes,
  SkillCapabilityKnowledgeError,
  createSkillCapabilityKnowledgeConsumer,
  skillCapabilityKnowledge,
} from "./capability-knowledge-core";
export type {
  SkillCapabilityKnowledgeErrorCode,
  SkillCapabilityManifestReference,
  SkillProfileCapability,
  SkillComponentCapability,
  SkillCapabilitySelection,
  SkillProviderCapabilityContext,
  CurrentDesignSkillInventoryEntry,
  SkillCapabilityKnowledgeConsumer,
} from "./capability-knowledge-core";

/** Preserves the actual executable legacy registry as the default inventory. */
export function listCurrentDesignSkillInventory(
  registry: DesignSkillRegistry = designSkillRegistry,
): readonly CurrentDesignSkillInventoryEntry[] {
  return projectCurrentDesignSkillInventory(registry);
}
