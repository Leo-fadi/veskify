# AR-06B composed Puck editing design

`createComposedPuckSession` owns one private canonical aggregate for one page, locale
and session instance. The session captures the page identifier and authority resolver,
freezes caller-owned canonical inputs, and pins the first accepted authority for each
owner. It issues an opaque identity token for each accepted session state. A callback
must present that exact issued token and all identity fields; a lookalike identity from
another session or an earlier epoch is rejected.

The Puck projection has empty top-level content and one root slot for each accepted
region. Each slot holds only its accepted registered sections. A component receives
only localized text/textarea fields derived from the existing registry metadata.
Installed Puck emits an empty `zones` object for root slots; this exact empty form is
accepted. Any nonempty mirror must contain every exact root-slot key and matching
item. It is redundant transport and is never canonical.

The Puck configuration renders each selectable wrapper through the compositor's bound
`renderSection` closure and renders root slots through its bound `renderWithRegions`
closure. No Puck field, slot or callback receives an unchecked layout, resolver,
composition or persisted aggregate. Accepted own keystrokes retain the mounted Puck
instance. A new session object or rejected transport resets from the
last valid projection. Read-only mode removes editing callbacks and rejects retained
earlier callbacks; rejected changes retain the valid preview and a merchant-readable
status message.

The editor uses Puck's installed CSS entrypoint without its external font import.
Its supported iframe override observes the actual frame document's content and sizes
the iframe without introducing a second layout stylesheet. Browser proof records the
actual iframe width and height and compares normalized shared-renderer geometry.
The visibility probe accounts only for the exact owning Puck selection wrapper when
Puck disables pointer events on its descendants; foreign overlays and hidden content
still fail. Section movement preserves the exact card, media and control records and
their order within each canonical owner.

The route is development, standalone and explicit-flag only, with bounded offset/stack
and English/Finnish selectors before fixture loading. It is a deterministic acceptance
surface, never normal Studio or a persistence endpoint.
