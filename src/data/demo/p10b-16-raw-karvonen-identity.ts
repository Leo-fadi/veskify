/**
 * Lightweight identity shared by the P10B-16L controlled bridge and the P10B-16P-03 normal
 * Storefront Studio entry. Keeping identity separate lets browser routing and storage decide
 * whether the raw project is requested without importing either fixture's synthesis authority.
 */
export const P10B16_RAW_KARVONEN_PROJECT_ID = "project_p10b16l_karvonen_raw" as const;
export const P10B16_RAW_KARVONEN_CATALOGUE_ID = "catalogue_p10b16l_karvonen" as const;
export const P10B16_RAW_KARVONEN_DRAFT_ID = "snapshot_p10b16l_karvonen_raw_draft" as const;
export const P10B16_RAW_KARVONEN_PUBLISHED_ID = "snapshot_p10b16l_karvonen_raw_published" as const;
