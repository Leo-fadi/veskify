import { aurumNordicSeed } from "@/data/seed";
import { InMemoryProjectRepository } from "./in-memory-project-repository";

export function createAurumNordicProjectRepository(): InMemoryProjectRepository {
  return new InMemoryProjectRepository([
    {
      project: aurumNordicSeed.project,
      catalogue: aurumNordicSeed.catalogue,
      snapshots: [aurumNordicSeed.publishedSnapshot, aurumNordicSeed.draftSnapshot],
    },
  ]);
}
