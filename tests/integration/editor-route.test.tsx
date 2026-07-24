/* eslint-disable @typescript-eslint/unbound-method */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createDeterministicMockAIProvider,
  type AIProvider,
  type AiOperationRequest,
} from "@/application/ai-provider";
import {
  createDeterministicMockStorefrontAIProvider,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";
import type { ProposalAnalyticsEvent } from "@/application/analytics";
import { ProjectEditorClient } from "@/app/projects/[projectId]/editor/project-editor-client";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import type { PageModel } from "@/domain/storefront";
import { browserProposalAnalyticsEventType } from "@/services/analytics";
import {
  InMemoryProjectRepository,
  ProjectNotFoundError,
  RepositoryValidationError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

vi.mock("@/integrations/puck/veskify-puck-editor", () => ({
  VeskifyPuckCanvas: ({
    page,
    context,
    brandSystem,
    onPageChange,
    onValidationError,
    onSelectedSectionChange,
    readOnly,
    readOnlyLabel,
  }: {
    page: {
      id: string;
      type: string;
      title: Record<string, string | undefined>;
      sections: Array<{ id: string; component: string; visible: boolean }>;
    };
    context: { activeLocale: string };
    brandSystem: { colors: { primary: string } };
    onPageChange: (page: unknown) => void;
    onValidationError: (message: string) => void;
    onSelectedSectionChange?: (sectionId: string | undefined) => void;
    readOnly?: boolean;
    readOnlyLabel?: string;
  }) => (
    <section
      aria-label={readOnly ? (readOnlyLabel ?? "Proposal preview canvas") : "Visual editor canvas"}
      data-page={JSON.stringify(page)}
      data-primary={brandSystem.colors.primary}
      lang={context.activeLocale}
    >
      Canvas: {page.type} / {context.activeLocale}
      {readOnlyLabel === "Proposal preview canvas" ? <span>Locked proposal</span> : null}
      <button onClick={() => onSelectedSectionChange?.(undefined)} type="button">
        Clear section selection
      </button>
      {page.sections.map((section) => (
        <div key={`section-${section.id}`}>
          {section.visible ? null : <span>Hidden {section.component} section</span>}
          <button onClick={() => onSelectedSectionChange?.(section.id)} type="button">
            Select {section.component} section
          </button>
          {!["header", "footer"].includes(section.component) ? (
            <button
              disabled={readOnly}
              onClick={() =>
                onPageChange({
                  ...page,
                  sections: page.sections.filter((candidate) => candidate.id !== section.id),
                })
              }
              type="button"
            >
              Remove {section.component} section
            </button>
          ) : null}
        </div>
      ))}
      {readOnlyLabel === "Proposal preview canvas" ? (
        <button
          onClick={() =>
            onPageChange({
              ...page,
              title: { ...page.title, [context.activeLocale]: "Newer canonical edit" },
            })
          }
          type="button"
        >
          Simulate newer canonical edit
        </button>
      ) : null}
      <button
        disabled={readOnly}
        onClick={() =>
          onPageChange({
            ...page,
            title: {
              ...page.title,
              [context.activeLocale]:
                page.title[context.activeLocale] === `Edited ${page.type}`
                  ? `Edited again ${page.type}`
                  : `Edited ${page.type}`,
            },
          })
        }
        type="button"
      >
        Edit current page
      </button>
      <button disabled={readOnly} onClick={() => onPageChange({ ...page, id: "!" })} type="button">
        Emit invalid canonical page
      </button>
      <button
        disabled={readOnly}
        onClick={() =>
          onPageChange({
            ...page,
            sections: page.sections.map((section, index) =>
              index === 0 ? { ...section, id: "section_home_announcement" } : section,
            ),
          })
        }
        type="button"
      >
        Create cross-page duplicate
      </button>
      <button
        disabled={readOnly}
        onClick={() => onValidationError("That change could not be applied safely.")}
        type="button"
      >
        Emit invalid change
      </button>
    </section>
  ),
}));

const aggregate = (): ProjectAggregate => ({
  project: structuredClone(aurumNordicSeed.project),
  catalogue: structuredClone(aurumNordicSeed.catalogue),
  snapshots: [
    structuredClone(aurumNordicSeed.publishedSnapshot),
    structuredClone(aurumNordicSeed.draftSnapshot),
  ],
});

const karvonenAggregate = (): ProjectAggregate => ({
  project: structuredClone(karvonenSeed.project),
  catalogue: structuredClone(karvonenSeed.catalogue),
  snapshots: [
    structuredClone(karvonenSeed.publishedSnapshot),
    structuredClone(karvonenSeed.draftSnapshot),
  ],
});

describe("P4-05D editor storefront integration", () => {
  const openStorefrontTarget = async () => {
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Entire storefront" }));
  };

  const createWarmStorefrontProposal = async () => {
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Apply a warm premium style across the storefront." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    return screen.findByLabelText("Storefront design proposal");
  };

  const confirmStorefrontProposal = () => {
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply storefront proposal" }));
  };

  it("offers page and storefront targets while disabling section scope without a selection", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    expect(screen.getByRole("radio", { name: "Current page" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Selected section" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Entire storefront" })).toBeEnabled();
  });

  it("enables and automatically selects section scope for an eligible canvas selection", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    expect(screen.getByRole("radio", { name: "Selected section" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Selected section" })).toBeChecked();
  });

  it("falls back to Current page when a page switch removes the selected-section target", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    expect(screen.getByRole("radio", { name: "Selected section" })).toBeChecked();

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });

    await screen.findByText("Canvas: collection / en");
    expect(screen.getByRole("radio", { name: "Current page" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Selected section" })).toBeDisabled();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("changes targets without mutating the active draft", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await openStorefrontTarget();
    fireEvent.click(screen.getByRole("radio", { name: "Current page" }));
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("treats selecting the already active target as a no-op", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    fireEvent.click(screen.getByRole("radio", { name: "Entire storefront" }));
    expect(screen.getByLabelText("Storefront design proposal")).toBeVisible();
  });

  it("generates one canonical entire-storefront proposal with planner-resolved coverage", async () => {
    const provider = new DeferredStorefrontProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      undefined,
      provider,
    );
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Apply a warm premium style across the storefront." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].target.affectedPageIds).toHaveLength(3);
    expect(provider.calls[0].target.affectedSectionTargets.length).toBeGreaterThan(0);
    await provider.resolve(0);
    expect(await screen.findByLabelText("Storefront design proposal")).toBeVisible();
  });

  it("renders merchant-readable global and per-page review without internal identities", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    const review = await createWarmStorefrontProposal();
    expect(review).toHaveTextContent("Shared storefront design");
    expect(review).toHaveTextContent("Homepage");
    expect(review).toHaveTextContent("Rings");
    expect(review).toHaveTextContent("Aurora Ring 585");
    expect(review.textContent).not.toMatch(
      /page_home|section_home|APPLY_APPROVED|storefront_proposal_/,
    );
  });

  it("previews storefront colour and page changes without changing the draft", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    const originalPrimary = (await screen.findByLabelText("Visual editor canvas")).getAttribute(
      "data-primary",
    );
    await createWarmStorefrontProposal();
    expect(screen.getByLabelText("Proposal preview canvas")).not.toHaveAttribute(
      "data-primary",
      originalPrimary,
    );
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("keeps the proposal open while previewing a referenced page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    fireEvent.click(screen.getByRole("button", { name: "Open a proposed page: Rings" }));
    expect(screen.getByLabelText("Storefront design proposal")).toBeVisible();
    expect(screen.getByLabelText("Proposal preview canvas")).toHaveTextContent("collection / en");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("accepts all storefront changes into one unsaved editor transaction", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    expect(screen.getByRole("dialog", { name: "Apply this storefront proposal?" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Apply storefront proposal" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Design request")).toHaveAttribute(
        "data-agent-state",
        "accepted",
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes"),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });

  it("undoes and redoes an accepted storefront proposal atomically", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    const before = screen.queryByLabelText("Visual editor canvas")?.getAttribute("data-primary");
    await createWarmStorefrontProposal();
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeEnabled();
    confirmStorefrontProposal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled());
    const accepted = screen.getByLabelText("Visual editor canvas").getAttribute("data-primary");
    expect(accepted).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Visual editor canvas")).toHaveAttribute("data-primary", before);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByLabelText("Visual editor canvas")).toHaveAttribute("data-primary", accepted);
  });

  it("rejects a ready storefront proposal without draft mutation", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.queryByLabelText("Storefront design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("closes a ready storefront proposal without draft mutation", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Storefront design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("supersedes a ready storefront proposal when the merchant changes target", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await createWarmStorefrontProposal();
    fireEvent.click(screen.getByRole("radio", { name: "Current page" }));
    expect(screen.queryByLabelText("Storefront design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Design request")).toHaveAttribute(
      "data-agent-state",
      "superseded",
    );
  });

  it("ignores a delayed storefront result after a canonical page mutation", async () => {
    const provider = new DeferredStorefrontProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      undefined,
      provider,
    );
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Apply a warm premium style across the storefront." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove hero section" }));
    await provider.resolve(0);
    expect(screen.queryByLabelText("Storefront design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
  });

  it("supports the exact Finnish entire-storefront request and review labels", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("radio", { name: "Koko verkkokauppa" }));
    fireEvent.change(screen.getByLabelText("Pyyntösi"), {
      target: { value: "Käytä lämmintä premium-ilmettä koko kaupassa." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Luo ehdotus" }));
    const review = await screen.findByLabelText("Storefront design proposal");
    expect(review).toHaveTextContent("Verkkokaupan yhteinen ilme");
    expect(review).toHaveTextContent("Etusivu");
  });

  it("shows one retry for unsupported storefront instructions without draft mutation", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Rebuild the storefront navigation." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("uses the existing canonical page request path when Current page is selected", async () => {
    const provider = new RecordingProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(provider.calls[0].target).toEqual({ pageId: "page_home" });
  });

  it("prevents duplicate storefront submission while generation is pending", async () => {
    const provider = new DeferredStorefrontProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      undefined,
      provider,
    );
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Apply a warm premium style across the storefront." },
    });
    const create = screen.getByRole("button", { name: "Create proposal" });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(provider.calls).toHaveLength(1);
    await provider.resolve(0);
  });

  it("prevents a cancelled delayed storefront result from becoming ready", async () => {
    const provider = new DeferredStorefrontProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      undefined,
      provider,
    );
    await openStorefrontTarget();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Apply a warm premium style across the storefront." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await provider.resolve(0);
    expect(screen.queryByLabelText("Storefront design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("keeps stored and published snapshots unchanged until explicit Save draft", async () => {
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    route(value);
    await createWarmStorefrontProposal();
    confirmStorefrontProposal();
    await waitFor(() =>
      expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes"),
    );
    const afterAccept = await value.get(aurumNordicSeed.project.id);
    expect(afterAccept.snapshots).toEqual(before.snapshots);
    expect(afterAccept.project.draftSnapshotId).toBe(before.project.draftSnapshotId);
    expect(afterAccept.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
  });
});

function repository(get: ProjectRepository["get"]): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(get),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

const statefulRepository = () => new InMemoryProjectRepository([aggregate()]);

const route = (
  value: ProjectRepository,
  aiProvider?: AIProvider,
  storefrontAiProvider?: StorefrontAIProvider,
) =>
  render(
    <ProjectEditorClient
      aiProvider={aiProvider}
      projectId="project_aurum_nordic"
      repositoryFactory={() => value}
      storefrontAiProvider={storefrontAiProvider}
    />,
  );

class RecordingProvider implements AIProvider {
  readonly calls: AiOperationRequest[] = [];
  readonly #inner = createDeterministicMockAIProvider();

  proposeChange(request: AiOperationRequest) {
    this.calls.push(structuredClone(request));
    return this.#inner.proposeChange(request);
  }
}

class DeferredProvider implements AIProvider {
  readonly calls: AiOperationRequest[] = [];
  readonly #resolvers: Array<(value: unknown) => void> = [];

  proposeChange(request: AiOperationRequest): Promise<unknown> {
    this.calls.push(structuredClone(request));
    return new Promise((resolve) => this.#resolvers.push(resolve));
  }

  async resolve(index: number) {
    const response = await createDeterministicMockAIProvider().proposeChange(this.calls[index]);
    this.#resolvers[index](response);
  }

  reject(index: number) {
    this.#resolvers[index](Promise.reject(new Error("provider unavailable")));
  }
}

class DeferredStorefrontProvider implements StorefrontAIProvider {
  readonly id = "deterministic-storefront-mock";
  readonly calls: AiStorefrontProviderRequest[] = [];
  readonly #resolvers: Array<(value: unknown) => void> = [];

  proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown> {
    this.calls.push(structuredClone(request));
    return new Promise((resolve) => this.#resolvers.push(resolve));
  }

  async resolve(index: number) {
    const response = await createDeterministicMockStorefrontAIProvider().proposeStorefront(
      this.calls[index],
    );
    this.#resolvers[index](response);
  }
}

const visibleCanvasPage = () =>
  JSON.parse(screen.getByLabelText("Visual editor canvas").getAttribute("data-page")!) as PageModel;

describe("P2-01 project editor route", () => {
  it("hydrates the Karvonen editor from the isolated Karvonen page tree", async () => {
    const value = repository(() => Promise.resolve(karvonenAggregate()));
    render(
      <ProjectEditorClient projectId={karvonenSeed.project.id} repositoryFactory={() => value} />,
    );

    expect(await screen.findByRole("heading", { name: "Karvonen" })).toBeVisible();
    expect(value.get).toHaveBeenCalledWith(karvonenSeed.project.id);
    expect(screen.getByText("Canvas: home / fi")).toBeVisible();
    expect(screen.getByLabelText("Kauppasivuston sivu")).toHaveValue("page_karvonen_home");
    expect(screen.queryByText(/Aurum Nordic|Aurum-hero|Aurora/i)).not.toBeInTheDocument();
  });

  it("loads the canonical draft without writing storage", async () => {
    const value = repository(() => Promise.resolve(aggregate()));
    route(value);
    expect(screen.getByRole("heading", { name: "Loading visual editor" })).toBeVisible();
    expect(await screen.findByText("Aurum Nordic")).toBeVisible();
    expect(value.get).toHaveBeenCalledWith("project_aurum_nordic");
    expect(value.saveDraft).not.toHaveBeenCalled();
    expect(value.publish).not.toHaveBeenCalled();
    expect(value.restore).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
  });

  it("shows navigation, draft status and the selected preview link", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Aurum Nordic");
    expect(screen.getByRole("navigation", { name: "Editor navigation" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic",
    );
    expect(screen.getByRole("link", { name: "Publish changes" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/publish",
    );
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
  });

  it("switches page and project-scoped preview links", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    const switcher = await screen.findByLabelText("Storefront page");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Homepage",
      "Rings",
      "Aurora Ring 585",
    ]);
    fireEvent.change(switcher, { target: { value: "page_collection_rings" } });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/collections/rings",
    );
    fireEvent.change(switcher, { target: { value: "page_product_aurora" } });
    expect(screen.getByText("Canvas: product / en")).toBeVisible();
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/products/aurora-ring-585",
    );
  });

  it("switches the shell and canvas to Finnish", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByText("Canvas: home / fi")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Editorin navigointi" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Storefront Studion moduulit" })).toBeVisible();
    for (const label of [
      "Yleiskatsaus",
      "Määritykset",
      "Editori",
      "Esikatselu",
      "Julkaiseminen",
      "Historia",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }
    expect(screen.getByTestId("draft-status")).toHaveAccessibleName("Luonnoksen tila");
    expect(screen.getByTestId("draft-status")).toHaveTextContent("Ei tallentamattomia muutoksia");
    expect(screen.getByRole("button", { name: "Kumoa" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tee uudelleen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tallenna luonnos" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Esikatsele kauppaa" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Julkaise muutokset" })).toBeVisible();
    expect(screen.getByLabelText("Kauppasivuston sivu")).toBeVisible();
    expect(screen.getByRole("button", { name: "Suunnitteluavustaja" })).toBeVisible();
    expect(
      screen.queryByText(/No unsaved changes|Save draft|Overview|Storefront page/i),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kauppasivuston sivu"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByRole("heading", { name: "Sormukset" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Sormukset" })).toBeVisible();
  });

  it.each([
    [
      "missing project",
      () => Promise.reject(new ProjectNotFoundError("missing")),
      "Project not found",
    ],
    [
      "validation error",
      () => Promise.reject(new RepositoryValidationError("technical detail")),
      "Editor could not display this draft",
    ],
    [
      "storage error",
      () => Promise.reject(new Error("IndexedDB transaction detail")),
      "Editor could not load the project",
    ],
  ])("shows a safe %s state", async (_name, get, heading) => {
    route(repository(get));
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.queryByText(/technical detail|transaction detail/i)).not.toBeInTheDocument();
  });

  it("handles a missing draft and retries without repository writes", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const repo = repository(() => Promise.resolve(value));
    route(repo);
    expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(repo.get).toHaveBeenCalledTimes(2));
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("rejects cross-page canonical sections before opening Puck", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "collection")!.sections[1].component = "productInfo";
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Editor could not display this draft" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Visual editor canvas")).not.toBeInTheDocument();
  });

  it("keeps session dirty state separate from stored draft differences", async () => {
    const value = aggregate();
    const publishedBefore = structuredClone(value.snapshots[0]);
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "home")!.title.en = "Edited homepage";
    route(repository(() => Promise.resolve(value)));
    expect(await screen.findByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent(
      "stored draft differs from the published storefront",
    );
    expect(value.snapshots[0]).toEqual(publishedBefore);
  });

  it("tracks canonical in-memory changes without repository writes", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.queryByRole("link", { name: "Publish changes" })).not.toBeInTheDocument();
    expect(screen.getByText("Publish changes")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/save these changes to the draft before publishing/i)).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("undoes and redoes a manual Puck mutation without repository writes", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByText("Undid the last change on this page.")).toBeVisible();
    expect(redo).toBeEnabled();

    fireEvent.click(redo);
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("does not intercept history shortcuts while the merchant is typing", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    const request = screen.getByLabelText("Your request");
    request.focus();
    fireEvent.keyDown(request, { key: "z", ctrlKey: true });
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
  });

  it("duplicates a selected section as one undoable and redoable action", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    const before = visibleCanvasPage();
    const sourceIndex = before.sections.findIndex((section) => section.component === "hero");

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    const duplicated = visibleCanvasPage();
    expect(duplicated.sections).toHaveLength(before.sections.length + 1);
    expect(duplicated.sections[sourceIndex + 1]).toEqual({
      ...duplicated.sections[sourceIndex],
      id: `${duplicated.sections[sourceIndex].id}_copy`,
    });
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero — Copy 2"),
    ).toBeVisible();
    expect(screen.getByText(/Hero — Copy 2 was created and selected/i)).toHaveAttribute(
      "role",
      "status",
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(visibleCanvasPage()).toEqual(before);
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero", {
        exact: true,
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(visibleCanvasPage()).toEqual(duplicated);
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero — Copy 2"),
    ).toBeVisible();
  });

  it("labels and selects several duplicated instances deterministically in English and Finnish", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero — Copy 3"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(
      within(screen.getByLabelText("Valitun osion toiminnot")).getByText("Hero-osio — kopio 3"),
    ).toBeVisible();
  });

  it("hides and shows the selected section with undo and redo", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    const original = visibleCanvasPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByText("Hidden hero section")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.queryByText("Hidden hero section")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Hidden hero section")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(visibleCanvasPage()).toEqual(original);
  });

  it("keeps required header and footer section actions disabled", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    for (const component of ["header", "footer"]) {
      fireEvent.click(screen.getByRole("button", { name: `Select ${component} section` }));
      expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Hide" })).toBeDisabled();
      expect(screen.getByText(/must remain visible and can only appear once/i)).toBeVisible();
    }
  });

  it("allows a legacy-hidden required section to be shown, undone and redone", async () => {
    const value = aggregate();
    const draft = value.snapshots.find(
      (snapshot) => snapshot.id === value.project.draftSnapshotId,
    )!;
    const homepage = draft.pages.find((page) => page.type === "home")!;
    homepage.sections.find((section) => section.component === "header")!.visible = false;
    route(repository(() => Promise.resolve(value)));
    await screen.findByText("Canvas: home / en");
    expect(screen.getByText("Hidden header section")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Select header section" }));
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.queryByText("Hidden header section")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Hidden header section")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.queryByText("Hidden header section")).not.toBeInTheDocument();
    expect(
      visibleCanvasPage().sections.find((section) => section.component === "header")?.visible,
    ).toBe(true);
  });

  it("clears selection when a selected section disappears and preserves it when it remains", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove hero section" }));
    expect(screen.getByText(/select a section on the canvas/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Select hero section" })).toBeVisible();
    expect(screen.getByText(/select a section on the canvas/i)).toBeVisible();
  });

  it("confirms discard and restores the originally loaded page", async () => {
    const confirm = vi.spyOn(window, "confirm");
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it("reuses validation and discard safeguards in the compact editor drawer", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((media: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: media === "(max-width: 63.99rem)",
        media,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    try {
      route(repository(() => Promise.resolve(aggregate())));
      await screen.findByText("Canvas: home / en");
      await user.click(screen.getByRole("button", { name: "Edit current page" }));
      await user.click(screen.getByRole("button", { name: "Emit invalid change" }));
      await user.click(screen.getByRole("button", { name: "Pages & sections" }));

      let dialog = screen.getByRole("dialog", { name: "Pages & sections" });
      expect(within(dialog).getByText("That change could not be applied safely.")).toHaveAttribute(
        "role",
        "alert",
      );
      const discard = within(dialog).getByRole("button", { name: "Discard changes" });
      expect(discard).toBeEnabled();
      await user.click(discard);
      expect(confirm).toHaveBeenCalledWith(
        "Discard the unsaved changes on this page? This cannot be undone.",
      );
      expect(within(dialog).getByRole("button", { name: "Discard changes" })).toBeDisabled();
      expect(within(dialog).getByText(/save draft becomes available/i)).toBeVisible();

      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await user.click(screen.getByRole("radio", { name: "Suomi" }));
      await user.click(screen.getByRole("button", { name: "Sivut ja osiot" }));
      dialog = screen.getByRole("dialog", { name: "Sivut ja osiot" });
      expect(
        within(dialog).getByRole("button", { name: "Peruuta sivun muutokset" }),
      ).toBeDisabled();
      expect(within(dialog).getByText(/luonnoksen tallennus tulee käyttöön/i)).toBeVisible();
      expect(within(dialog).getByRole("button", { name: "Sulje" })).toBeVisible();
    } finally {
      confirm.mockRestore();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("warns before page switches and isolates each page's session edits", async () => {
    const confirm = vi.spyOn(window, "confirm");
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    confirm.mockReturnValueOnce(false);
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
    confirm.mockReturnValueOnce(true);
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_home" },
    });
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    confirm.mockRestore();
  });

  it("keeps undo and redo histories isolated per page", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "Rings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_home" },
    });
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    confirm.mockRestore();
  });

  it("announces invalid changes while retaining the last valid page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Emit invalid change" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be applied safely");
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("edits only the active Finnish locale in session state", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
  });

  it("previews a supported luxury proposal without mutating the active page", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByLabelText("Proposal preview canvas")).toHaveTextContent("Locked proposal");
    expect(screen.getByText(/current page is unchanged/i)).toBeVisible();
    expect(screen.getByLabelText("Design proposal")).toHaveTextContent("Planned changes");
    const details = within(screen.getByLabelText("Proposed changes")).getAllByRole("listitem");
    expect(details.length).toBeGreaterThan(1);
    expect(
      details.some((detail) =>
        /background|typography|spacing|layout/i.test(detail.textContent ?? ""),
      ),
    ).toBe(true);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
    expect(repo.restore).not.toHaveBeenCalled();
  });

  it("passes the merchant's actual selected section into a section-scoped request", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero", {
        exact: true,
      }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero", {
        exact: true,
      }),
    ).toBeVisible();
    expect(screen.getByText("Home · 1 sections", { exact: true })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Select productGrid section" }));
    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Product grid", {
        exact: true,
      }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported yet/i);
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
  });

  it("keeps the affected selected section after acceptance", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    await screen.findByText(/accepted for draft application/i);

    expect(
      within(screen.getByLabelText("Selected section actions")).getByText("Hero", {
        exact: true,
      }),
    ).toBeVisible();
  });

  it("previews a supported minimal proposal without mutating the active page", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByLabelText("Design proposal")).toHaveTextContent(
      /simplify the layout/i,
    );
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("asks one material clarification before creating a proposal and moves focus to the answer", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make it better." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const answer = await screen.findByLabelText("Your answer");
    expect(
      screen.getByRole("heading", {
        name: "What should feel better: a more luxurious look or a more minimal layout?",
      }),
    ).toBeVisible();
    expect(answer).toHaveFocus();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.change(answer, { target: { value: "Make the layout more minimal." } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("supports a Finnish clarification and localized status", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.change(screen.getByLabelText("Pyyntösi"), {
      target: { value: "Tee siitä parempi." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Luo ehdotus" }));
    const answer = await screen.findByLabelText("Vastauksesi");
    expect(
      screen.getByRole("heading", { name: /ylellisempää ilmettä vai pelkistetympää/i }),
    ).toBeVisible();
    fireEvent.change(answer, { target: { value: "Tee asettelusta pelkistetympi." } });
    fireEvent.click(screen.getByRole("button", { name: "Jatka" }));
    expect(await screen.findByText(/ehdotus on valmis tarkistettavaksi/i)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByLabelText("Design proposal")).toBeVisible();
  });

  it("supports the exact Finnish selected-hero request", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Pyyntösi"), {
      target: { value: "Paranna valittua hero-osiota." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Luo ehdotus" }));
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByText("Etusivu · 1 osiota", { exact: true })).toBeVisible();
  });

  it("revises a proposal through the orchestrator without changing the active page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const first = await screen.findByLabelText("Design proposal");
    const firstId = first.getAttribute("data-proposal-id");
    const firstPreview = JSON.parse(
      screen.getByLabelText("Proposal preview canvas").getAttribute("data-page")!,
    ) as PageModel;
    fireEvent.change(screen.getByLabelText("How should this proposal change?"), {
      target: { value: "Make it more minimal." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Design proposal")).not.toHaveAttribute(
        "data-proposal-id",
        firstId,
      ),
    );
    expect(screen.getByLabelText("Design proposal")).toHaveTextContent(/simplify the layout/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    const latestPreview = JSON.parse(
      screen.getByLabelText("Proposal preview canvas").getAttribute("data-page")!,
    ) as PageModel;
    expect(latestPreview).not.toEqual(firstPreview);
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    await waitFor(() => expect(visibleCanvasPage()).toEqual(latestPreview));
  });

  it("regenerates with a new lifecycle identity and preserves the active page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const firstId = (await screen.findByLabelText("Design proposal")).getAttribute(
      "data-proposal-id",
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Design proposal")).not.toHaveAttribute(
        "data-proposal-id",
        firstId,
      ),
    );
    expect(screen.getByText(/regenerated proposal is ready/i)).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("cancels a proposal and start over returns the panel to a clean workflow", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.getByText(/request was cancelled/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText("Your request")).toHaveValue("");
    expect(screen.getByText("Ready for a design request.")).toBeVisible();
  });

  it("supports the request and proposal flow with keyboard controls and focus", async () => {
    const user = userEvent.setup();
    route(repository(() => Promise.resolve(aggregate())));
    const request = await screen.findByLabelText("Your request");
    await user.type(request, "Make the layout more minimal.");
    await user.tab();
    expect(screen.getByRole("button", { name: "Create proposal" })).toHaveFocus();
    await user.keyboard("{Enter}");
    const proposal = await screen.findByLabelText("Design proposal");
    expect(proposal.querySelector("h3")).toHaveFocus();
    expect(screen.getByText(/proposal is ready to review/i)).toHaveAttribute("role", "status");
  });

  it("accepts and rejects proposals with keyboard activation", async () => {
    const user = userEvent.setup();
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    screen.getByRole("button", { name: "Reject" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(/page remains unchanged/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    screen.getByRole("button", { name: "Accept and apply" }).focus();
    await user.keyboard(" ");
    expect(await screen.findByText(/accepted for draft application/i)).toBeVisible();
  });

  it("closes a proposal when its edited base is discarded and cannot restore discarded edits", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Proposal preview canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and apply" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("alert")).toHaveTextContent(/page changed after this request started/i);
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("invalidates a proposal after a newer canonical mutation and preserves that newer page", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("button", { name: "Simulate newer canonical edit" }));

    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and apply" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Newer canonical edit" })).toBeVisible();
    expect(screen.getByText(/start a new request from the current page/i)).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("closes a homepage proposal on page switch and does not restore it on return", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Proposal preview canvas")).not.toBeInTheDocument();
    expect(screen.getByText(/page changed after this request started/i)).toBeVisible();
    expect(screen.getByLabelText("Your request")).toHaveValue(
      "Make the homepage feel more luxurious.",
    );

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_home" },
    });
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and apply" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("canonically stales a ready proposal when the locale changes", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));

    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hyväksy ja käytä" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/sivu muuttui/i);
    expect(screen.getByLabelText("Pyyntösi")).toHaveValue("Add a campaign section.");
  });

  it("accepts a campaign proposal into only the in-memory homepage", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    expect(await screen.findByText(/accepted for draft application/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    confirm.mockRestore();
  });

  it("records repeated acceptance of a multi-operation proposal exactly once", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    const original = visibleCanvasPage();
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const previewCanvas = await screen.findByLabelText("Proposal preview canvas");
    const preview = JSON.parse(previewCanvas.getAttribute("data-page")!) as PageModel;
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    const accept = screen.getByRole("button", { name: "Accept and apply" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    await waitFor(() => expect(visibleCanvasPage()).toEqual(preview));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(visibleCanvasPage()).toEqual(original);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(visibleCanvasPage()).toEqual(preview);
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("does not add proposal preview or rejection to editor history", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("rejects a proposal and preserves the exact current page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText(/page remains unchanged/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
  });

  it("emits proposal analytics without merchant or provider content", async () => {
    const events: ProposalAnalyticsEvent[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<ProposalAnalyticsEvent>).detail);
    };
    window.addEventListener(browserProposalAnalyticsEventType, listener);
    try {
      route(repository(() => Promise.resolve(aggregate())));
      await screen.findByText("Canvas: home / en");
      fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
      fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
      await screen.findByLabelText("Design proposal");
      expect(events.map((event) => event.name)).toContain("ai_proposal_generated");

      fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
      await screen.findByText(/accepted for draft application/i);
      expect(events.map((event) => event.name)).toContain("ai_proposal_accepted");

      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
      fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
      await screen.findByLabelText("Design proposal");
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      expect(events.map((event) => event.name)).toContain("ai_proposal_rejected");
      expect(JSON.stringify(events)).not.toMatch(
        /campaign section|merchantPrompt|importedContent/i,
      );
      expect(events.every((event) => event.projectId === "project_aurum_nordic")).toBe(true);
    } finally {
      window.removeEventListener(browserProposalAnalyticsEventType, listener);
    }
  });

  it("shows unsupported and invalid requests without changing the page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), { target: { value: "Add fireworks" } });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported yet/i);
    expect(screen.getByLabelText("Proposal unavailable")).toHaveTextContent(
      /try the request again or continue editing manually/i,
    );
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported yet/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("renders grouped proposal details in the active Finnish locale", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Lisää kampanjaosio." }));
    fireEvent.click(screen.getByRole("button", { name: "Luo ehdotus" }));
    expect(await screen.findByRole("heading", { name: /kampanjaosio/i })).toBeVisible();
    expect(screen.getByText("Etusivu · 1 osiota", { exact: true })).toBeVisible();
    const localizedDetails = within(screen.getByLabelText("Ehdotetut muutokset")).getAllByRole(
      "listitem",
    );
    expect(localizedDetails).toHaveLength(1);
    expect(localizedDetails[0]).toHaveTextContent(/lisää tämä/i);
    expect(localizedDetails[0]).toHaveTextContent(/suomenkielinen otsikko/i);
    expect(screen.getByRole("button", { name: "Hyväksy ja käytä" })).toBeEnabled();
  });

  it("saves a valid manual edit, clears dirty state and preserves locale and published state", async () => {
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    const save = screen.getByRole("button", { name: "Tallenna luonnos" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(await screen.findByText("Luonnos tallennettiin.")).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Luonnoksen tila")).toHaveTextContent(
      "Ei tallentamattomia muutoksia",
    );
    expect(screen.getByRole("radio", { name: "Suomi" })).toBeChecked();
    expect(screen.getByText("Canvas: home / fi")).toBeVisible();
    const after = await value.get(aurumNordicSeed.project.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    ).toEqual(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );

    expect(screen.getByRole("button", { name: "Kumoa" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Kumoa" }));
    expect(screen.getByLabelText("Luonnoksen tila")).toHaveTextContent(
      "Tallentamattomia muutoksia",
    );
    expect(visibleCanvasPage().title).toEqual({ en: "Home", fi: "Etusivu" });
    const afterUndo = await value.get(aurumNordicSeed.project.id);
    expect(afterUndo).toEqual(after);
  });

  it("saves multiple session pages and preserves the untouched product page", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    const untouchedProduct = structuredClone(
      before.snapshots
        .find((snapshot) => snapshot.id === before.project.draftSnapshotId)!
        .pages.find((page) => page.type === "product"),
    );
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");

    const after = await value.get(aurumNordicSeed.project.id);
    const saved = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.draftSnapshotId,
    )!;
    expect(saved.pages.find((page) => page.type === "home")?.title.en).toBe("Edited home");
    expect(saved.pages.find((page) => page.type === "collection")?.title.en).toBe(
      "Edited collection",
    );
    expect(saved.pages.find((page) => page.type === "product")).toEqual(untouchedProduct);
    confirm.mockRestore();
  });

  it("persists an accepted proposal through the same canonical save path", async () => {
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    const publishedBefore = structuredClone(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );
    route(value);
    await screen.findByText("Canvas: home / en");
    const original = visibleCanvasPage();
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const previewCanvas = await screen.findByLabelText("Proposal preview canvas");
    const accepted = JSON.parse(previewCanvas.getAttribute("data-page")!) as PageModel;
    expect(await value.get(aurumNordicSeed.project.id)).toEqual(before);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    await screen.findByText(/accepted for draft application/i);
    expect(visibleCanvasPage()).toEqual(accepted);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(visibleCanvasPage()).toEqual(original);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(visibleCanvasPage()).toEqual(accepted);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");

    const after = await value.get(aurumNordicSeed.project.id);
    const saved = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.draftSnapshotId,
    )!;
    expect(saved.pages.find((page) => page.type === "home")?.sections).toHaveLength(11);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.publishedSnapshotId),
    ).toEqual(publishedBefore);
  });

  it("treats edits after save as new work and discards to the latest saved baseline", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = statefulRepository();
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited again home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    confirm.mockRestore();
  });

  it("blocks saving invalid page and complete-snapshot states", async () => {
    route(statefulRepository());
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Emit invalid canonical page" }));
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByText(/page change is not valid yet/i)).toHaveAttribute("role", "alert");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create cross-page duplicate" }));
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByText(/changes need attention before this draft can be saved/i),
    ).toHaveAttribute("role", "alert");
  });

  it("keeps dirty work after storage and stale failures and allows a successful retry", async () => {
    const inner = statefulRepository();
    let failSave = true;
    const value: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      create: (aggregate) => inner.create(aggregate),
      saveDraft: (id, snapshot, expected) =>
        failSave
          ? Promise.reject(new Error("storage unavailable"))
          : inner.saveDraft(id, snapshot, expected),
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("refuses a stale save while keeping the editor work dirty", async () => {
    const value = statefulRepository();
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    const newer = structuredClone(aurumNordicSeed.draftSnapshot);
    newer.id = "snapshot_external_newer";
    newer.pages[0].title.en = "External newer home";
    await value.saveDraft(aurumNordicSeed.project.id, newer);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/newer draft was saved elsewhere/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    const after = await value.get(aurumNordicSeed.project.id);
    expect(after.project.draftSnapshotId).toBe(newer.id);
  });

  it("locks draft mutations and saves exactly the captured canonical session", async () => {
    const inner = statefulRepository();
    const before = await inner.get(aurumNordicSeed.project.id);
    const publishedBefore = structuredClone(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );
    let releaseSave!: () => void;
    let capturedHomeTitle: string | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const value: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      create: (aggregate) => inner.create(aggregate),
      saveDraft: async (id, snapshot, expected) => {
        capturedHomeTitle = snapshot.pages.find((page) => page.type === "home")?.title.en;
        await gate;
        return inner.saveDraft(id, snapshot, expected);
      },
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText(/Saving your draft… Please wait/i)).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      screen.getByText(/Saving your draft… Please wait/i).closest('[aria-busy="true"]'),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Saving draft…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();
    expect(screen.getByLabelText("Storefront page")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit current page" })).toBeDisabled();
    expect(screen.getByLabelText("Your request")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create proposal" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Make the homepage feel more luxurious." }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    await waitFor(() => expect(capturedHomeTitle).toBe("Edited home"));

    releaseSave();
    await screen.findByText("Draft saved successfully.");
    expect(
      screen.getByText("Draft saved successfully.").closest('[aria-busy="false"]'),
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");

    const after = await inner.get(aurumNordicSeed.project.id);
    const saved = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.draftSnapshotId,
    )!;
    expect(saved.pages.find((page) => page.type === "home")?.title.en).toBe("Edited home");
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.publishedSnapshotId),
    ).toEqual(publishedBefore);
  });

  it("restores controls and retains dirty work after a delayed save failure", async () => {
    const inner = statefulRepository();
    const before = await inner.get(aurumNordicSeed.project.id);
    const publishedBefore = structuredClone(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );
    let releaseSave!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const value: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      create: (aggregate) => inner.create(aggregate),
      saveDraft: async () => {
        await gate;
        throw new Error("delayed storage failure");
      },
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("button", { name: "Saving draft…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();

    releaseSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled();
    expect(screen.getByLabelText("Storefront page")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit current page" })).toBeEnabled();
    expect(screen.getByLabelText("Your request")).toBeEnabled();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();

    const after = await inner.get(aurumNordicSeed.project.id);
    expect(after.project.draftSnapshotId).toBe(before.project.draftSnapshotId);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.publishedSnapshotId),
    ).toEqual(publishedBefore);
  });
});

describe("P4-04 editor AI command integration", () => {
  it("builds canonical page, selected-section and planner-resolved section requests", async () => {
    const provider = new RecordingProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    await screen.findByText("Canvas: home / en");

    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(provider.calls[0]).toMatchObject({
      target: { pageId: "page_home" },
      scope: "page",
      locale: "en",
    });
    expect(screen.getByLabelText("Your request")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(provider.calls[1]).toMatchObject({
      target: { pageId: "page_home", sectionId: "section_home_hero" },
      scope: "section",
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(provider.calls[2]).toMatchObject({
      target: { pageId: "page_home" },
      scope: "page",
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Select header section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByRole("alert");
    expect(provider.calls).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear section selection" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(provider.calls[3].target).toEqual({
      pageId: "page_home",
      sectionId: "section_home_hero",
    });
  });

  it("rejects an empty keyboard submission and localizes composer guidance", async () => {
    const provider = new RecordingProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    const request = await screen.findByLabelText("Your request");
    expect(request).toHaveAttribute(
      "placeholder",
      "For example: Make the homepage feel more luxurious.",
    );
    expect(screen.getByText(/Control or Command \+ Enter/i)).toBeVisible();

    fireEvent.change(request, { target: { value: "   " } });
    fireEvent.keyDown(request, { key: "Enter", ctrlKey: true });
    expect(await screen.findByRole("alert")).toHaveTextContent(/describe the storefront change/i);
    expect(provider.calls).toHaveLength(0);
    expect(request).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create proposal" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByLabelText("Pyyntösi")).toHaveAttribute(
      "placeholder",
      "Esimerkiksi: Tee etusivusta ylellisempi.",
    );
    expect(screen.getByText(/Control tai Command \+ Enter/i)).toBeVisible();
  });

  it("deduplicates double submit and starts a distinct request after locale changes", async () => {
    const provider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    const request = await screen.findByLabelText("Your request");
    fireEvent.change(request, { target: { value: "Make the layout more minimal." } });
    const form = request.closest("form");
    if (!form) throw new Error("Expected the canonical request form.");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].locale).toBe("en");

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    const finnishRequest = screen.getByLabelText("Pyyntösi");
    expect(finnishRequest).toHaveValue("Make the layout more minimal.");
    fireEvent.change(finnishRequest, { target: { value: "Tee asettelusta pelkistetympi." } });
    fireEvent.keyDown(finnishRequest, { key: "Enter", ctrlKey: true });
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].locale).toBe("fi");

    await provider.resolve(1);
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByLabelText("Pyyntösi")).toHaveValue("");
    await provider.resolve(0);
    expect(screen.getByLabelText("Design proposal")).toBeVisible();
  });

  it("immediately supersedes delayed generation after relevant page content changes", async () => {
    const editProvider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      editProvider,
    );
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(editProvider.calls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Edit current page" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/page changed/i);
    const request = screen.getByLabelText("Your request");
    expect(request).toBeEnabled();
    expect(request).toHaveValue("Make the homepage feel more luxurious.");
    fireEvent.change(request, { target: { value: "Make the layout more minimal." } });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(editProvider.calls).toHaveLength(2);
    await editProvider.resolve(0);
    expect(screen.getByText(/preparing the design proposal/i)).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    await editProvider.resolve(1);
    expect(await screen.findByLabelText("Design proposal")).toHaveTextContent(
      /simplify the layout/i,
    );
  });

  it("immediately supersedes delayed generation after selection changes", async () => {
    const selectionProvider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      selectionProvider,
    );
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(selectionProvider.calls).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Select productGrid section" }));
    expect(screen.getByLabelText("Design request")).toHaveAttribute(
      "data-agent-state",
      "superseded",
    );
    const request = screen.getByLabelText("Your request");
    expect(request).toBeEnabled();
    expect(request).toHaveValue("Improve the selected hero.");
    fireEvent.change(request, { target: { value: "Make the layout more minimal." } });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(selectionProvider.calls).toHaveLength(2);
    await selectionProvider.resolve(0);
    expect(screen.getByText(/preparing the design proposal/i)).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    await selectionProvider.resolve(1);
    expect(await screen.findByLabelText("Design proposal")).toHaveTextContent(
      /simplify the layout/i,
    );
  });

  it("closes context-bound clarification for locale and section changes", async () => {
    const first = route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make it better." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    const answer = await screen.findByLabelText("Your answer");
    fireEvent.change(answer, { target: { value: "Make it luxurious." } });
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.queryByLabelText("Vastauksesi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jatka" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Pyyntösi")).toHaveValue("Make it better.");
    first.unmount();

    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make it better." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Your answer");
    fireEvent.click(screen.getByRole("button", { name: "Select productGrid section" }));
    expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your request")).toHaveValue("Make it better.");
  });

  it("supersedes a delayed revision on locale change and ignores its result", async () => {
    const provider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await provider.resolve(0);
    await screen.findByLabelText("Design proposal");
    fireEvent.change(screen.getByLabelText("How should this proposal change?"), {
      target: { value: "Make it more minimal." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    expect(provider.calls).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/kieli vaihtui/i);
    expect(screen.getByLabelText("Pyyntösi")).toHaveValue("Make the homepage feel more luxurious.");
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    await provider.resolve(1);
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
  });

  it("keeps a ready proposal for duplicate selection and stales it for a true target change", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Improve the selected hero." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("button", { name: "Select hero section" }));
    expect(screen.getByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Select productGrid section" }));
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and apply" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/page changed/i);
    expect(screen.getByLabelText("Your request")).toHaveValue("Improve the selected hero.");
  });

  it("keeps retryable provider failures safe, focused and privacy-preserving", async () => {
    const events: ProposalAnalyticsEvent[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<ProposalAnalyticsEvent>).detail);
    };
    window.addEventListener(browserProposalAnalyticsEventType, listener);
    try {
      const provider: AIProvider = {
        proposeChange: () => Promise.reject(new Error("provider-secret-stack-detail")),
      };
      route(
        repository(() => Promise.resolve(aggregate())),
        provider,
      );
      const request = await screen.findByLabelText("Your request");
      fireEvent.change(request, {
        target: { value: "Make the homepage feel more luxurious." },
      });
      fireEvent.keyDown(request, { key: "Enter", metaKey: true });

      expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
      expect(request).toHaveValue("Make the homepage feel more luxurious.");
      const retry = screen.getByRole("button", { name: "Retry" });
      expect(retry).toHaveFocus();
      expect(screen.getByRole("button", { name: "Create proposal" })).toBeEnabled();
      expect(document.body).not.toHaveTextContent("provider-secret-stack-detail");
      expect(events.map((event) => event.name)).toEqual([
        "ai_prompt_submitted",
        "generation_failed",
      ]);
      expect(JSON.stringify(events)).not.toMatch(/homepage feel more luxurious|provider-secret/i);
    } finally {
      window.removeEventListener(browserProposalAnalyticsEventType, listener);
    }
  });

  it("retries once with the preserved instruction and current canonical context", async () => {
    const user = userEvent.setup();
    const provider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    await screen.findByText("Canvas: home / en");
    await user.click(screen.getByRole("button", { name: "Select hero section" }));
    const request = await screen.findByLabelText("Your request");
    await user.type(request, "Improve the selected hero.");
    await user.click(screen.getByRole("button", { name: "Create proposal" }));
    provider.reject(0);
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry).toHaveFocus();
    expect(request).toHaveValue("Improve the selected hero.");

    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    const finnishRetry = screen.getByRole("button", { name: "Yritä uudelleen" });
    finnishRetry.focus();
    await user.keyboard("{Enter}");
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]).toMatchObject({
      instruction: "Improve the selected hero.",
      locale: "fi",
      target: { pageId: "page_home", sectionId: "section_home_hero" },
    });
    await provider.resolve(1);
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
  });

  it("prevents repeated retry activation while pending and after the single retry fails", async () => {
    const provider = new DeferredProvider();
    route(
      repository(() => Promise.resolve(aggregate())),
      provider,
    );
    const request = await screen.findByLabelText("Your request");
    fireEvent.change(request, {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    provider.reject(0);
    const retry = await screen.findByRole("button", { name: "Retry" });

    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(provider.calls).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    provider.reject(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(request).toHaveValue("Make the homepage feel more luxurious.");

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));
    expect(provider.calls).toHaveLength(3);
  });
});
