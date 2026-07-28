# P9-04A Editor workspace UX

## Outcome and requirements

The Storefront Studio editor now uses a compact, full-height workspace shell. It implements the
merchant-facing editor expectations in FR-114 through FR-116, NFR-102, NFR-103, NFR-108 and
NFR-109, and AC-112, AC-122 and AC-123. It is a presentation and navigation change only: the
canonical draft, proposal, history, save and publishing contracts remain unchanged.

## Compact toolbar and workspace

The editor header is one project toolbar. It shows Storefront Studio, the project and selected page
without repeating an identical page/project title, language, draft and publish status, undo/redo,
workspace-panel controls, preview, Save draft and Publish changes. Preview is a single purposeful
action; legacy module tabs, duplicated preview controls and developer terminology are not shown.

The desktop workspace is one ordered shell: Pages & sections on the left, the visual editor canvas
in the centre and Design/AI contextual tools on the right. The Design field bridge remains inside
the isolated Puck integration, but its merchant-facing destination is the outer workspace panel, so
the canvas is no longer narrowed by a nested tool rail.

## Responsive workspace and panels

At wide desktop widths, the outer Vesko navigation rail remains compact and the three workspace
areas remain independently visible. At narrow tablet and mobile widths, Pages & sections and
Design/AI open as accessible drawers instead of compressing the canvas. Drawer focus, Escape,
close-action restoration, keyboard navigation and the existing Design/AI tabs are preserved.

The editor is verified at 375, 768, 1024 and 1440 px without document-level horizontal overflow.
The toolbar stays reachable on narrow screens and the canvas remains the dominant working area.

## Identity, actions and preserved workflows

All visible editor language remains merchant-facing in English and Finnish. Existing selected-page,
locale, selected-section, proposal, proposal preview, acceptance/rejection, undo/redo, Save draft,
publish gating, draft restoration and preview workflows retain their existing behaviour.

## Remaining final integration checkpoint

P9-04A does not alter planner/provider selection, component registry/configuration, canonical
commerce data, product/collection/PDP presentation, authoritative persistence, publishing rules or
Puck configuration. The remaining P9-04 checkpoint is integrated visual and merchant acceptance of
the complete workspace alongside the existing editor workflows.
