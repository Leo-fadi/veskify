# AR-06B approach

AR-06B adds a guarded, unsaved Puck editing boundary for the accepted AR-06A static
composition. The private edit session retains a fully validated `StorefrontSnapshot`,
canonical catalogue and locale/evidence inputs. It projects only registered localized
content text fields and current composed regions into transient Puck root slots.

Puck data never becomes a page tree or persistence format. Each accepted delta is
rebuilt from the retained aggregate, compiled by the existing composition compiler,
and validated again before the session replaces its current unsaved aggregate. The
shared compositor remains the sole renderer for the frame, main, regions, pairs,
offset geometry and registered content.

The integration rejects stale identities, unknown or hidden fields, cross-region
moves, insertions, deletion, duplication, media, catalogue, variant and topology
changes. It permits the existing primary-discovery unit permutation and explicit
localized text changes only. Save, history, publication, normal Studio rollout and
executable collection/search/PDP composition remain outside AR-06B.
