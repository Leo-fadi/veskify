import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  commercialContentSupportProfileIds,
  getCommercialContentSupportProfile,
} from "@/application/storefront-templates";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createP10B12ContentSupportProof } from "@/data/demo/p10b-12-content-support-proof";
import { aurumNordicSeed } from "@/data/seed";

const effectiveVariant = {
  "content-about-story": "aboutStory",
  "content-about-process": "aboutProcess",
  "content-contact-channels": "contactChannels",
  "content-contact-directory": "contactDirectory",
  "content-location-directory": "locationDirectory",
  "content-location-appointments": "locationDirectory",
  "content-faq-disclosure": "faqDisclosure",
  "content-faq-topic-guide": "faqDisclosure",
  "content-service-details": "serviceDetails",
  "content-policy-reading": "policyReading",
  "content-generic-reading": "genericReading",
  "content-generic-editorial": "genericEditorial",
  "landing-campaign-editorial": "campaignEditorial",
  "landing-campaign-image-led": "campaignEditorial",
  "landing-campaign-story": "campaignStory",
} as const;

function proofFor(
  profileId: (typeof commercialContentSupportProfileIds)[number],
  options: Parameters<typeof createP10B12ContentSupportProof>[0] = {
    familyId: "about",
    profileId: "content-about-story",
  },
) {
  const profile = getCommercialContentSupportProfile(profileId)!;
  const familyId = options.familyId ?? profile.profile!.commercialContentSupport!.pageFamilyIds[0];
  const proof = createP10B12ContentSupportProof({ ...options, familyId, profileId });
  const page = proof.snapshot.pages.find(({ id }) => id === proof.pageId)!;
  const context = createStorefrontRenderContext({
    activeLocale: "en",
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue: aurumNordicSeed.catalogue,
    snapshot: proof.snapshot,
    renderTarget: "preview",
    evidenceReferences: [proof.document.evidence],
  });
  const rendered = render(<>{renderStorefrontPage(page, context)}</>);
  return { ...rendered, proof };
}

describe("P10B-18B-05 content/support authority correction", () => {
  it("renders all 15 registered profiles with truthful current-generation identity", () => {
    expect(commercialContentSupportProfileIds).toHaveLength(15);
    for (const profileId of commercialContentSupportProfileIds) {
      const profile = getCommercialContentSupportProfile(profileId)!;
      const familyId = profile.profile!.commercialContentSupport!.pageFamilyIds[0];
      const { container, unmount } = proofFor(profileId, { familyId, profileId });
      const section = container.querySelector('[data-component="contentSupport"]');
      expect(section, profileId).not.toBeNull();
      expect(section, profileId).toHaveAttribute("data-variant", effectiveVariant[profileId]);
      if (profileId === "content-location-appointments") {
        expect(section).toHaveAttribute("data-reclassified-from", "locationAppointments");
      }
      if (profileId === "content-faq-topic-guide") {
        expect(section).toHaveAttribute("data-reclassified-from", "faqTopicGuide");
      }
      if (profileId === "landing-campaign-image-led") {
        expect(section).toHaveAttribute("data-reclassified-from", "campaignImageLed");
      }
      unmount();
    }
  });

  it("keeps about story and approved process visibly different", () => {
    const story = proofFor("content-about-story");
    expect(story.container.querySelectorAll("ol li")).toHaveLength(0);
    expect(story.container).toHaveTextContent("From sketchbook to keepsake");
    story.unmount();

    const process = proofFor("content-about-process");
    expect(process.container.querySelectorAll("ol li").length).toBeGreaterThanOrEqual(3);
    expect(process.container).toHaveTextContent("Listen");
    expect(process.container).toHaveTextContent("Finish");
  });

  it("requires exact approved presentation media before retaining image-led identity", () => {
    const withoutMedia = proofFor("landing-campaign-image-led", {
      familyId: "campaign-editorial",
      profileId: "landing-campaign-image-led",
    });
    const fallback = withoutMedia.container.querySelector('[data-component="contentSupport"]');
    expect(fallback).toHaveAttribute("data-variant", "campaignEditorial");
    expect(fallback).toHaveAttribute("data-reclassified-from", "campaignImageLed");
    expect(fallback?.querySelector("img")).toBeNull();
    withoutMedia.unmount();

    const withMedia = proofFor("landing-campaign-image-led", {
      familyId: "campaign-editorial",
      profileId: "landing-campaign-image-led",
      approvedMedia: true,
    });
    const imageLed = withMedia.container.querySelector('[data-component="contentSupport"]');
    expect(imageLed).toHaveAttribute("data-variant", "campaignImageLed");
    expect(imageLed).not.toHaveAttribute("data-reclassified-from");
    expect(imageLed?.querySelector("img")).toHaveAccessibleName();
  });

  it("renders only an exactly paired canonical campaign action", () => {
    const paired = proofFor("landing-campaign-editorial", {
      familyId: "campaign-editorial",
      profileId: "landing-campaign-editorial",
      campaignActionAuthority: "paired",
    });
    const action = paired.container.querySelector(
      '[data-content-support-action="campaign"][data-campaign-navigation-id]',
    );
    expect(action).toBeInstanceOf(HTMLAnchorElement);
    expect(action).toHaveAttribute("href");
    expect(action?.getAttribute("href")).not.toBe("#");
    paired.unmount();

    const absent = proofFor("landing-campaign-editorial", {
      familyId: "campaign-editorial",
      profileId: "landing-campaign-editorial",
      campaignActionAuthority: "absent",
    });
    expect(absent.container.querySelector('[data-content-support-action="campaign"]')).toBeNull();
    absent.unmount();

    const labelOnly = proofFor("landing-campaign-editorial", {
      familyId: "campaign-editorial",
      profileId: "landing-campaign-editorial",
      campaignActionAuthority: "label-only",
    });
    expect(
      labelOnly.container.querySelector('[data-content-support-action="campaign"]'),
    ).toBeNull();
  });
});
