export const p10b18cCorrectionPass1Evidence = {
  contractVersion: "p10b-18c-correction-pass-1-evidence-v1",
  failures: [
    {
      code: "mobile-product-card-content-overlap",
      owner: "canonicalProductCardFamily:imageFirst:imageFirstReorder",
      caseId: "aurum-approved-presentation-image-rich--premium-campaign-image-led",
      capture:
        "aurum-approved-presentation-image-rich-premium-campaign-image-led-premiumeditorial-aurum-approved-presentation-image-rich-home-375px.png",
      customerDisplayEligible: false,
    },
    {
      code: "fi-visible-verification-prose",
      owner: "production-disabled Karvonen catalogue fixture",
      caseId: "image-evidence-poor--premium-campaign-image-led",
      sourceFields: [
        "availabilityLabel",
        "attributes.material",
        "attributes.colour",
        "attributes.stone",
      ],
      capture:
        "image-evidence-poor-premium-campaign-image-led-premiumeditorial-image-evidence-poor-home-1440px.png",
      customerDisplayEligible: false,
    },
    {
      code: "nextjs-development-indicator-capture-contamination",
      owner: "P10B-18C evidence harness",
      customerDisplayEligible: false,
    },
  ],
} as const;
