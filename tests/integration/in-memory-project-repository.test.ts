import { createAurumNordicProjectRepository } from "@/services/storage";
import { runProjectRepositoryContract } from "./project-repository.contract";

runProjectRepositoryContract("InMemoryProjectRepository", () =>
  createAurumNordicProjectRepository(),
);
