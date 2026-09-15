import { describe, expect, it } from "vitest";
import {
  createComposedStorefrontCandidate as create,
  validateComposedStorefrontSnapshot as validate,
} from "@/application/storefront-templates/bind-storefront-composition";
import { canonicalStorefrontContentFingerprint as fingerprint } from "@/domain/storefront/canonical-storefront";
import { parseStorefrontSnapshotVersion as parse } from "@/domain/storefront/storefront-composition-version";
import {
  createCompiledPageBlueprintCompositionV1,
  compiledPageBlueprintCompositionV1Schema,
} from "@/domain/storefront/compiled-page-blueprint-composition";
import {
  createDynamicCommercePresentationAuthorityV2,
  parseDynamicCommercePresentationVersion,
} from "@/domain/storefront/dynamic-commerce-composition-version";
import { ar05bFixture, ar05bStructuralDynamic } from "../helpers/ar-05b-composition-fixtures";

import { ar05aFixture } from "../helpers/ar-05a-composition-fixtures";

const clone = <T>(value: T): T => structuredClone(value);
function frozen(value: unknown): boolean {
  return (
    !value ||
    typeof value !== "object" ||
    (Object.isFrozen(value) && Object.values(value).every(frozen))
  );
}
function home(value: ReturnType<typeof ar05bFixture>["create"] extends () => infer R ? R : never) {
  const page = value.pages.find((page) => "composition" in page);
  if (!page || !("composition" in page)) throw new Error("Expected composed page");
  return page;
}

describe("AR-05B canonical composition", () => {
  it("binds multiple actual owners and revalidates retained owners in a later partial selection", () => {
    const f = ar05bFixture();
    const collection = ar05aFixture({ family: "collection" });
    const base = { ...f.base, pages: [...f.base.pages, collection.page] };
    const resolve = (input: { owner: { id: string } }) => {
      if (input.owner.id === collection.page.id) {
        const { owner: _owner, ...authority } = collection.authority;
        void _owner;
        return authority;
      }
      return f.authority();
    };
    const request = {
      ...f.request,
      expectedBase: { ...f.request.expectedBase, contentFingerprint: fingerprint(base) },
      assignments: [...f.request.assignments, { selection: collection.selection }],
    };
    const first = create(base, request, resolve);
    expect(first.pages.filter((p) => "composition" in p)).toHaveLength(2);
    expect(validate(first, resolve)).toEqual(first);
    const nextRequest = {
      ...f.request,
      expectedBase: {
        id: first.id,
        revision: first.revision,
        contentFingerprint: fingerprint(first),
      },
      successor: { ...f.request.successor, id: "snapshot_next", revision: first.revision + 1 },
    };
    expect(create(first, nextRequest, resolve).pages).toEqual(first.pages);
    const invalid = clone(first);
    invalid.pages.find((p) => p.id === collection.page.id)!.sections[0].variant = "missingVariant";
    const before = JSON.stringify(invalid);
    expect(() =>
      create(
        invalid,
        {
          ...nextRequest,
          expectedBase: { ...nextRequest.expectedBase, contentFingerprint: fingerprint(invalid) },
        },
        resolve,
      ),
    ).toThrow();
    expect(JSON.stringify(invalid)).toBe(before);
  });
  it("uses code-unit slot order for structural dynamic storage and rejects noncanonical reads", () => {
    const { dynamic } = ar05bStructuralDynamic();
    const { authorityFingerprint: _fp, ...material } = clone(dynamic);
    void _fp;
    const owner = material.collectionSearchArchetypes.find((o) => "composition" in o)!;
    const presentation = owner.componentPresentations[0];
    owner.componentPresentations = [
      { ...presentation, slotId: "slota" },
      { ...presentation, slotId: "slotZ" },
    ];
    const result = createDynamicCommercePresentationAuthorityV2(material);
    expect(
      result.collectionSearchArchetypes[0].componentPresentations.map((p) => p.slotId),
    ).toEqual(["slotZ", "slota"]);
    const reordered = clone(result);
    reordered.collectionSearchArchetypes[0].componentPresentations.reverse();
    expect(() => parseDynamicCommercePresentationVersion(reordered)).toThrow(/code-unit/);
    // This is structural storage proof only; it still carries unaccepted borrowed static topology.
  });
  it("round-trips the full static snapshot, one inventory and trusted owner with deep immutability", () => {
    const f = ar05bFixture();
    const before = JSON.stringify([f.base, f.request]);
    const value = f.create();
    const page = home(value);
    expect(validate(JSON.parse(JSON.stringify(value)), f.authority)).toEqual(value);
    expect(parse(value)).toEqual(value);
    expect(page.sections).toHaveLength(f.base.pages.find((p) => p.id === page.id)!.sections.length);
    expect(page.composition.regionAssignments.flatMap((r) => r.units)).toHaveLength(
      page.sections.filter((s) => s.visible).length,
    );
    expect(JSON.stringify(page.composition)).not.toMatch(
      /"(?:sections|content|props|price|productId)":/u,
    );
    expect(value.dynamicCommercePresentation).toEqual(f.base.dynamicCommercePresentation);
    expect(frozen(value)).toBe(true);
    expect(JSON.stringify([f.base, f.request])).toBe(before);
    expect(() => page.sections.reverse()).toThrow();
    let resolved = 0;
    expect(
      validate(value, (input) => {
        expect(frozen(input)).toBe(true);
        expect(input.owner).toEqual(page.composition.owner);
        resolved++;
        return f.authority();
      }),
    ).toEqual(value);
    expect(resolved).toBe(1);
    expect(() => validate(value, () => f.a.authority)).toThrow(/without an owner/);
  });
  it.each([undefined, null, "", "2.0.0", 1])(
    "rejects present invalid root marker %s without fallback",
    (marker) => {
      const f = ar05bFixture();
      expect(parse(f.base)).toEqual(f.base);
      expect(() => parse({ ...f.base, compositionExtensionVersion: marker })).toThrow();
    },
  );
  it.each(["id", "revision", "contentFingerprint"] as const)("rejects stale base %s", (field) => {
    const f = ar05bFixture();
    const request = clone(f.request);
    expect(() =>
      create(
        f.base,
        {
          ...request,
          expectedBase: { ...request.expectedBase, [field]: field === "revision" ? 999 : "wrong" },
        },
        f.authority,
      ),
    ).toThrow(/stale base/);
  });
  it.each(["id", "revision", "projectId", "catalogueRef", "createdAt", "createdBy"] as const)(
    "rejects inconsistent successor %s",
    (field) => {
      const f = ar05bFixture();
      const replacement =
        field === "id" ? f.base.id : field === "revision" ? f.base.revision : "wrong";
      expect(() =>
        create(
          f.base,
          { ...f.request, successor: { ...f.request.successor, [field]: replacement } },
          f.authority,
        ),
      ).toThrow();
    },
  );
  it("rejects duplicate/foreign owners and unknown request/selection fields atomically", () => {
    const f = ar05bFixture();
    const before = JSON.stringify(f.base);
    const assignment = f.request.assignments[0];
    expect(() =>
      create(f.base, { ...f.request, assignments: [assignment, assignment] }, f.authority),
    ).toThrow(/duplicate/);
    expect(() =>
      create(
        f.base,
        {
          ...f.request,
          assignments: [
            assignment,
            {
              selection: { ...assignment.selection, owner: { kind: "static-page", id: "foreign" } },
            },
          ],
        },
        f.authority,
      ),
    ).toThrow(/missing static owner/);
    const extra = { ...f.request, write: true };
    expect(() => create(f.base, extra, f.authority)).toThrow();
    const extraSelection = { ...assignment.selection, content: {} };
    expect(() =>
      create(f.base, { ...f.request, assignments: [{ selection: extraSelection }] }, f.authority),
    ).toThrow(/unknown selection/);
    expect(JSON.stringify(f.base)).toBe(before);
  });
  it("canonicalizes composed storage only on construction while preserving meaningful composition order", () => {
    const f = ar05bFixture();
    const value = f.create();
    const reversed = clone(f.base);
    reversed.pages.find((p) => p.id === f.a.selection.owner.id)!.sections.reverse();
    const request = {
      ...f.request,
      expectedBase: { ...f.request.expectedBase, contentFingerprint: fingerprint(reversed) },
    };
    expect(create(reversed, request, f.authority)).toEqual(value);
    const invalid = clone(value);
    home(invalid).sections.reverse();
    expect(() => parse(invalid)).toThrow(/code-unit/);
    const changed = clone(f.request);
    const units = changed.assignments[0].selection.regionAssignments.find(
      (r) => r.units.length > 1,
    )!.units;
    units.reverse();
    const reordered = create(f.base, changed, f.authority);
    expect(home(reordered).composition.compositionFingerprint).not.toBe(
      home(value).composition.compositionFingerprint,
    );
    expect(fingerprint(reordered)).not.toBe(fingerprint(value));
    expect(value.pages.filter((p) => !("composition" in p))).toEqual(
      f.base.pages.filter((p) => p.id !== f.a.selection.owner.id),
    );
  });
  it("includes content, marker and nested authority in content identity without a recursive hash", () => {
    const f = ar05bFixture();
    const value = f.create();
    const changed = clone(value);
    home(changed).title.en = "Changed copy";
    expect(validate(changed, f.authority)).toEqual(changed);
    expect(fingerprint(changed)).not.toBe(fingerprint(value));
    expect(fingerprint(value)).not.toBe(fingerprint(f.base));
    const { snapshot, dynamic } = ar05bStructuralDynamic();
    expect(fingerprint(snapshot)).not.toBe(fingerprint(f.base));
    const { authorityFingerprint: _fp, ...material } = dynamic;
    void _fp;
    const revised = createDynamicCommercePresentationAuthorityV2({
      ...material,
      authorityRevision: material.authorityRevision + 1,
    });
    expect(revised.authorityFingerprint).not.toBe(dynamic.authorityFingerprint);
    expect(fingerprint({ ...snapshot, dynamicCommercePresentation: revised })).not.toBe(
      fingerprint(snapshot),
    );
  });
  it.each([
    "owner",
    "missing-ref",
    "definition",
    "blueprint",
    "support",
    "capacity",
    "binding",
  ] as const)("revalidates retained %s authority", (kind) => {
    const f = ar05bFixture();
    const value = clone(f.create());
    const page = home(value);
    const authority = f.authority();
    if (kind === "owner") {
      const { compositionFingerprint: _fp, ...material } = page.composition;
      void _fp;
      page.composition = compiledPageBlueprintCompositionV1Schema.parse(
        createCompiledPageBlueprintCompositionV1({
          ...material,
          owner: { kind: "static-page", id: "foreign" },
        }),
      );
    }
    if (kind === "missing-ref") page.sections.shift();
    if (kind === "definition") authority.componentDefinitions = [];
    if (kind === "blueprint")
      authority.candidate = { ...f.a.candidate, candidateFingerprint: "stale" };
    if (kind === "support")
      authority.support = { ...authority.support, implementationFingerprint: "stale" };
    if (kind === "capacity")
      authority.requiredAssetRoleCapacityEvidence = {
        ...f.a.evidence,
        exactCandidateFingerprint: "stale",
      };
    if (kind === "binding") page.sections[0].variant = "missingVariant";
    const before = JSON.stringify(value);
    expect(() => validate(value, () => authority)).toThrow();
    expect(JSON.stringify(value)).toBe(before);
  });
  it("rejects wrong nesting, null composition, absent owners and stale composed bases", () => {
    const f = ar05bFixture();
    const value = f.create();
    expect(() => parse({ ...f.base, compositionExtensionVersion: "1.0.0" })).toThrow(
      /composed owner/,
    );
    expect(() => parse({ ...f.base, composition: home(value).composition })).toThrow();
    expect(() =>
      parse({
        ...value,
        pages: value.pages.map((p) => ("composition" in p ? { ...p, composition: null } : p)),
      }),
    ).toThrow();
    const changed = clone(value);
    home(changed).sections[0].variant = "missingVariant";
    const request = {
      ...f.request,
      expectedBase: {
        id: changed.id,
        revision: changed.revision,
        contentFingerprint: fingerprint(changed),
      },
      successor: { ...f.request.successor, id: "snapshot_next", revision: changed.revision + 1 },
    };
    expect(() => create(changed, request, f.authority)).toThrow();
  });
  it.each(["collection", "search", "product-detail"] as const)(
    "honestly rejects actual current %s inventory without anatomy fiction",
    (family) => {
      const f = ar05bFixture({ dynamic: true, family });
      const before = JSON.stringify(f.base);
      expect(() => f.create()).toThrow(
        family === "product-detail" ? /conversion/ : /primary-discovery/,
      );
      expect(JSON.stringify(f.base)).toBe(before);
    },
  );
  it("represents v2 explicitly with v1 coexistence but never treats syntax as dynamic acceptance", () => {
    const { fixture, dynamic, snapshot } = ar05bStructuralDynamic();
    expect(parseDynamicCommercePresentationVersion(dynamic)).toEqual(dynamic);
    expect(parse(snapshot)).toEqual(snapshot);
    expect(dynamic.productDetailArchetypes).toEqual(
      fixture.base.dynamicCommercePresentation!.productDetailArchetypes,
    );
    expect(() => validate(snapshot, fixture.authority)).toThrow();
    expect(() => parse({ ...fixture.base, dynamicCommercePresentation: dynamic })).toThrow();
    expect(() =>
      parseDynamicCommercePresentationVersion({ ...dynamic, contractVersion: "3.0.0" }),
    ).toThrow();
    expect(() =>
      parseDynamicCommercePresentationVersion({ ...dynamic, authorityFingerprint: "stale" }),
    ).toThrow(/fingerprint/);
    const { authorityFingerprint: _fp, ...material } = fixture.base.dynamicCommercePresentation!;
    void _fp;
    expect(() =>
      createDynamicCommercePresentationAuthorityV2({ ...material, contractVersion: "2.0.0" }),
    ).toThrow(/composed archetype/);
  });
  it.each(["duplicate", "mapping", "context", "protected", "owner"] as const)(
    "retains dynamic %s invariants",
    (kind) => {
      const { dynamic } = ar05bStructuralDynamic();
      const { authorityFingerprint: _fp, ...material } = clone(dynamic);
      void _fp;
      if (kind === "duplicate")
        material.collectionSearchArchetypes.push(material.collectionSearchArchetypes[0]);
      if (kind === "mapping") material.fallbacks.productDetailArchetypeId = "foreign";
      if (kind === "context") material.collectionSearchArchetypes[0].supportedContexts = [];
      if (kind === "protected")
        Object.assign(material.productDetailArchetypes[0], {
          commerceBindingPolicy: "unprotected",
        });
      if (kind === "owner") {
        const owner = material.collectionSearchArchetypes.find((o) => "composition" in o)!;
        owner.id = "foreign";
      }
      expect(() => createDynamicCommercePresentationAuthorityV2(material)).toThrow();
    },
  );
});
