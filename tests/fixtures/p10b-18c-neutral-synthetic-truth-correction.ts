export const P10B18C_STAGE_B_SYNTHETIC_FIXTURE_HUMAN_FAILURE = {
  classification: "P10B-18C Stage B human FAIL — synthetic fixture customer-truth defects",
  captureCount: 280,
  contactSheetCount: 37,
  affectedFinnishCaptureCount: 26,
  affectedCaseIds: [
    "mixed-jewellery-watch--premium-campaign-image-led",
    "mixed-jewellery-watch--premium-editorial-alternative",
    "neutral-true-high-consideration--minimal-product-first",
    "neutral-true-high-consideration--modern-balanced-utility",
  ],
  retainedEvidenceRoot:
    "/private/tmp/veskify-p10b-18c-retained-audit-20260821/final-stage-b-human-review-fail-mt303h8v",
  retainedHumanReview:
    "/private/tmp/veskify-p10b-18c-retained-audit-20260821/final-stage-b-human-review-fail-mt303h8v/p10b-18c-human-visual-review.json",
  defects: [
    "English audit and test prose rendered in Finnish storefronts",
    "a ring was presented as a worktable",
    "jewellery media was presented as watches",
    "internal fixture attributes reached customer-facing rendering",
  ],
} as const;

export const P10B18C_STAGE_B_FINAL_SYNTHETIC_MERCHANT_TRUTH_FAILURE = {
  classification: "P10B-18C Stage B human FAIL — stale synthetic merchant/catalogue identity",
  captureCount: 280,
  affectedCaptureCount: 4,
  affectedCaseIds: [
    "neutral-true-high-consideration--minimal-product-first",
    "neutral-true-high-consideration--modern-balanced-utility",
  ],
  affectedCaptureSequenceIndexes: [95, 98, 101, 104],
  visibleFailure: "Karvosen korujen demo-katalogi.",
  retainedEvidenceRoot:
    "/private/var/folders/wh/31lggb5x2256ghczqd00brjh0000gn/T/veskify-p10b-18c-commercial-quality-run-mt3daol5-b28fe072a4d85162",
  retainedHumanReview:
    "/private/var/folders/wh/31lggb5x2256ghczqd00brjh0000gn/T/veskify-p10b-18c-commercial-quality-run-mt3daol5-b28fe072a4d85162/p10b-18c-human-visual-review.json",
  retainedHumanReviewSha256: "fe5633f742c755ca9811dd973c9a8503a032092059b2b0c4647e106fbfe7f1c5",
} as const;
