**Verdict — publish after fixes.**

The shipping candidate needs corrections before it goes live. The redesign replaces the rejected form-first layout with a recognisable Command Center ledger. Its strongest details are the slashed count blocks, the colored section bars, the compact row actions and the empty-state artwork. The phone history can still take over the screen, and the planner can send players on a trip it says they are already making, price a high-quality item as ordinary, and still show item numbers at the point where a sync asks which edit to keep.

I reviewed pull request 7 at its pinned head, using the last outside-reviewed Lists version as the comparison. GitHub independently showed the same head for pull request 7. The assignment’s original status metadata named pull request 4, which is the baseline merge. The reviewed commit is the one specified in the prompt and assignment.

Technical: SplitzHappen/Eveniunt-Command-Center#7 · ec24562d3a1ee12ac5f99e7bed4b66a3904c3e33 · cfae181 · ASG-20261123-lists-redesign-review-chatgpt-001

## Publication choices

| Choice | What happens and what improves | Cost | Risk left and what you give up | Confidence |
| --- | --- | --- | --- | --- |
| Keep the live version | Leave the live site as it is. Players avoid the candidate’s defects while work stops or the branch stays available. | No release work now. Keeping an unreleased branch current takes time if work resumes, and the cost is unknown. | Current behavior and any current issues stay. Players give up the cleaner ledger, workshop plans and improved source information for now. | High about avoiding this candidate’s changes. |
| Publish this version now | Players get the full redesign and the added planning features immediately. | Little release work up front. Support and any rollback cost are unknown. | The reproduced phone and planning defects reach players. A rollback can restore the site but cannot recover choices players already made. Frequency is unknown. You give up a chance to fix these before players depend on them. | High that the reproduced defects can occur. Their frequency is unknown. |
| Publish after the fixes | Keep today’s site up while the major issues are corrected and the changed flows are checked again. Publish the full redesign once those cases pass. | More engineering and retesting time. The estimate is unknown. | Real phone and two-device behavior still need a check. You give up immediate access to the redesign. | High that the named fixes address the reproduced failures. Confidence in the revised release depends on the follow-up evidence. |
| Publish a smaller change separately | Prepare a separate candidate that contains only fixes or features that can stand on their own, then check that candidate before publishing. | Splitting, rebuilding and reviewing a different candidate adds work. The cost is unknown. | Shared data and save paths make the split easy to get wrong. Players give up whatever is left out, and this review does not establish the smaller candidate’s safety. | Moderate that a smaller change is feasible, with no basis to approve an unseen split. |

I recommend publishing after the fixes. The full redesign is worth keeping together, and the reproduced failures affect ordinary planning, buying and sync decisions.

## Appearance findings

### MAJOR — Earlier changes can cover the whole phone screen and hide its own close control

After ordinary stock edits, expanding history can make the plan and the history toggle unreachable by touch. Reloading to get out also clears the page’s undo history.

**Proposed fix.** Keep the latest status and the history toggle in a fixed, reachable line. Open earlier changes above it in a bounded, scrollable panel with a visible close, and keep the bottom navigation clear.

**Evidence.** The built status pictures show history below the summary, where the approved design puts it above the status line. In Chromium at 360 × 800, twenty stock increments made the history 1,065 pixels high, with its summary 283 pixels above the viewport. At 1,440 × 1,000 it covered 732 pixels. The fixed container and list have no height bound or internal scrolling.

Technical: [tracker/command-center/src/lists/lists.css:159](../../../../tracker/command-center/src/lists/lists.css#L159)

### MAJOR — The phone gathering ledger hides the node a player should look for

A player sees a level and coordinates but cannot tell from the row whether to look for a tree, a rocky outcrop or an unspoiled node. The game-time label and route reason also disappear. Crystals have no zone headers to make up for the missing aetheryte.

**Proposed fix.** Put the chosen game node, area and useful timing together in a short route line on the phone. Move secondary information into the drawer, and let the drawer identify the job for the chosen spot when several jobs are shown.

**Evidence.** In get-gather-phone-dark.png, Rose Garnet Ore reads “Lv. 100 · Shaaloani” while get-gather-desktop-light.png identifies a Legendary Rocky Outcrop. The phone crystals picture shows two job abbreviations beside coordinates for one job. The phone rule explicitly hides the node, aetheryte, route reason and Eorzea-time wording. The look spec requires the chosen spot at rest.

Technical: [tracker/command-center/src/lists/lists.css:541](../../../../tracker/command-center/src/lists/lists.css#L541)

### MINOR — Thin route headers and repeated controls make the shopping ledger harder to scan

Zone, nearby aetheryte and seller look like one run of small text on the phone. Long labels lose their useful end. On desktop the stepper and Have all form a high-contrast wall of repeated boxes, while purchase counts and the number of item types use similar numerals.

**Proposed fix.** Give zone and seller lines a little vertical room and a clear relationship, preserve long names, quiet the repeated stepper borders, and label section counts as item types. Restore an at-a-glance gil subtotal for the merchant offer if the row group can supply it.

**Evidence.** Compare get-vendors and get-gather at both sizes with the after/get and after/combined pairs. project-phone-dark.png shows “Near Camp Dragon…” on the same thin line as the zone. get-open-desktop-light.png repeats the Mustard Eggs seller and price in the row and the drawer. The merchant subtotal visible in the approved desktop get picture is absent from the build.

Technical: [tracker/command-center/src/lists/lists.css:660](../../../../tracker/command-center/src/lists/lists.css#L660)

### MINOR — Craft warnings compete with the item and the work order

Long gear names and repeating warnings are hard to scan on a phone. The generic “Book not ticked” forces a tap to learn which book. On desktop the repeating three-stamp cluster is louder than the crafts, and in the open row the high-quality control is detached from the related choices.

**Proposed fix.** Keep the item name and remaining work first. Group a discreet book warning and job information near the relevant job, show the book name where the warning appears, and put the high-quality choice directly under Get it by. Put the counted job beside the alternate jobs when ingredients differ.

**Evidence.** The craft, craft-open and craft-hq pairs show the effect on the Courtly Lover set, Grade 4 Gemsap and Ra’Kaznar Ingot. The finished build does follow the owner’s quieter outlined primary and name-adjacent chevron. The desktop recipe stamps are hidden wholesale at phone widths, and the counted-recipe explanation is emitted only in the open drawer at lists.js:747.

Technical: [tracker/command-center/src/lists/lists.js:758](../../../../tracker/command-center/src/lists/lists.js#L758)

### MINOR — Phone totals, step shares and list settings compete for the same header space

The phone hides the character-total caption, so the larger counts can look like the list or phase total. The built combined title truncates early and phase tabs extend past the visible edge. The step hand-in control is easy to confuse with a small generic button unrelated to the selected phase.

**Proposed fix.** Keep a visible “Character total” cue, give three tallies their own row at narrow widths, keep the version and price place readable, and visibly signal the remaining phases. Place the hand-in action beside the strip on desktop and across the phone below it, as approved.

**Evidence.** head-phone-dark.png and combined-phone-dark.png place three 24-pixel figures beside the name. In project and steps, the slab reads 1,656 to get and 221 to craft while All steps for the project has 1,233 and 183. The desktop step action sits below at the left and the phone action occupies only part of the row, unlike after/steps. The committed phone measurements put the first get and Wanted rows 203 and 210 pixels below the masthead against a 200-pixel budget.

Technical: [tracker/command-center/src/lists/lists.css:487](../../../../tracker/command-center/src/lists/lists.css#L487)

### MINOR — The Restored list card makes recovery and removal look like adjacent text

A player trying to recover saved items has to distinguish two nearly touching actions after scrolling past their other lists. The large color stripe consumes space the explanation and actions need.

**Proposed fix.** Use the approved filled recovery action and open the character picker from it. Keep the count block short, and put the separately spaced Remove action in a secondary position with its existing confirmation.

**Evidence.** In restored-phone-dark.png, the recovery text runs directly into “Remove” and the salmon count band runs the full recovery card. restored-desktop-light.png also shows an unfilled primary and the exposed select. The after/restored pair shows the intended recovery hierarchy. The current catalogued confirmation still asks before removal.

Technical: [tracker/command-center/src/lists/lists.js:1114](../../../../tracker/command-center/src/lists/lists.js#L1114)

### MINOR — Wanted still reads like a form with repetitive metadata

The amount is a plain number box, the search hint is clipped on the phone, and “ordinary” repeats on every ordinary row. In the phone drawer the visible “Amount, quality and step” link is generic when there are no steps. Project hits sit under the same Amount field even though they always make one part’s list.

**Proposed fix.** Use the house stepper for player-entered quantities, keep the search label and short hint readable, omit the ordinary default when special quality is already stamped, and label the drawer control for the fields actually available. Clarify that a project search result makes a list for one part.

**Evidence.** wanted-phone-dark.png shows the project hit mixed with a trade hit, wanted-open-phone-dark.png cuts the hint after “item nam”, and wanted-open-desktop-light.png shows the bare Amount box. The after/wanted pair and the later stepper rule supply the comparison. The project click uses the project data directly without reading the Amount field.

Technical: [tracker/command-center/src/lists/lists.js:1176](../../../../tracker/command-center/src/lists/lists.js#L1176)

### MINOR — Settings and the order ladder still have avoidable wording and layout friction

The hide setting uses an action that changes names while its switch has no visible On or Off word. Phone users have to scroll to the fifth rung, and the footer’s small reset link competes with Close. The first and fourth rungs repeat their label immediately in the description.

**Proposed fix.** Give the switch a stable name and visible state. Keep the five-step ladder, shorten repeated wording, and keep the footer’s main control full width on the phone with reset separate. Use “North America” as the display text while keeping the price service’s saved key.

**Evidence.** See order and settings at both widths. The desktop sheet and the phone’s themed controls otherwise follow the approved format. The open patch notice also reads more like a generic alert than the approved colored note, and patch-closed-phone-dark.png takes two lines despite the owner’s request for a compact single line.

Technical: [tracker/command-center/src/lists/lists.js:919](../../../../tracker/command-center/src/lists/lists.js#L919)

## Game facts, behavior, safety and checks

### MAJOR — High-quality shopping rows use the ordinary-quality market price

A player can budget an order for the ordinary price while the plan requires high-quality stock. The same figure is repeated in the market subtotal and presented as the cheapest listing.

**Proposed fix.** Keep market quotes by item and quality, ask the price service for the relevant quality, and total only matching quotes. Show unknown for a high-quality price the service cannot supply or the cache cannot distinguish. Keep the Lists price cache isolated from Submersibles.

**Evidence.** Chromium, both widths. A high-quality Bronze Ingot routed to the market with a controlled response that listed ordinary at 100 gil and high quality at 10,000 showed “100 gil” on the high-quality row and in its subtotal. The parser takes the first listing regardless of quality and the cache and price lookup have no quality key. The generic quote predates the redesign, and the new bulk quality action expands its reach.

Technical: [tracker/command-center/src/lists/lists.js:50](../../../../tracker/command-center/src/lists/lists.js#L50)

### MAJOR — Gathering can claim a route stop no other displayed row uses

A player follows the stated route and makes a needless zone change, potentially for a timed node. An item in a different list can also influence a single-list display without being part of that trip.

**Proposed fix.** Choose from the stops actually assigned to outstanding rows in the current visible plan. Use a deterministic baseline and evaluate any change against the resulting route, then produce the reason from the same result that drives the zone headers and windows.

**Evidence.** Chromium at both widths with just Navigator’s Dagger and Unaspected Crystal. The dagger stays in Lower La Noscea at Moraby Drydocks, while the crystal says “Chosen: on your route in Western La Noscea” at the Swiftperch-side node. The dagger could go to Western La Noscea, but the displayed route has neither another row there nor a reduced number of stops. The helper counts all possible zones of other lines and receives the character-wide plan. C178 covers a fixed companion zone, so it passes this implementation.

Technical: [tracker/command-center/src/lists/engine.js:543](../../../../tracker/command-center/src/lists/engine.js#L543)

### MAJOR — The shipped sync prompt still identifies Lists items by number

When deciding which stock count, method or wanted entry to keep, a player can see an item number with no game name. Picking the wrong side can discard a real edit even though the underlying merge can preserve it until the player answers.

**Proposed fix.** Connect a lazy, offline-capable item-name lookup to the actual conflict flow, or present those questions in the Command Center with that lookup. Preserve numeric fallback for unknown items. Add a flow-level check with a real conflicting Lists stock entry.

**Evidence.** Settings directs a conflict to the Tracker. tracker/src/core/merge.js:394 calls CC.describeUnit with five arguments, and the new name lookup is the sixth argument at tracker/src/core/save.js:331. No production caller passes it. The passing helper test at tracker/tests/lists-patch.test.js:77 supplies its own lookup and never opens the conflict flow. The build record claims item names in sync questions.

Technical: [tracker/command-center/src/settings.js:308](../../../../tracker/command-center/src/settings.js#L308)

### MAJOR — Spearfishing rows tell players to find a generic fishing spot

A player looking for Teeming Waters or Swimming Shadows sees the label for ordinary fishing. The app can send them to the right coordinates with the wrong gathering instruction.

**Proposed fix.** Use the nonzero game node-name row for spearfishing. Reserve the fishing-spot name and its fallback for actual rod-fishing entries. Test both a spottable fish and both spearfishing node types.

**Evidence.** GatheringPointName rows 21 and 22 are “teeming waters” and “swimming shadows”. The dataset contains 31 such entries across 19 items. Gauntlet Crab uses node 469, row 21, at Yanxia X 15, Y 37.9, but spotName returns “Fishing spot” for all Fisher rows without a separate fishing-spot name. The data tool derived the correct type.

Technical: [tracker/command-center/src/lists/lists.js:617](../../../../tracker/command-center/src/lists/lists.js#L617)

### MINOR — Unplaced gathering sources lose valid timing and node-kind information

When no candidate spot has a usable map, the row can read as untimed even when some source entries have timed windows. A player gets neither the time nor the explanation that source details are incomplete.

**Proposed fix.** Keep the distinct source schedules and verified node kinds even without a map when the source provides them. Use the unknown-location wording for the map only, and make the preferred usable location rule explicit.

**Evidence.** Cloud Cotton Boll has only unplaced sources in the build. Pinned Teamcraft nodes 412, 413 and 414 have two-hour windows beginning at 0 and 12, 4 and 16, and 8 and 20. ExportedGatheringPoint row 412 identifies an unspoiled harvesting node. The data tool collects the loose entries but keeps a single zero-window row when there are no placed ones. This is separate from the acknowledged absence of a usable map.

Technical: [tracker/tools/lists-data.py:530](../../../../tracker/tools/lists-data.py#L530)

### MINOR — A list-scoped control silently sets high quality across the character’s plans

A player tuning one list can change unrelated projects and shopping needs. The control’s title explains the scope on hover, but there is no equivalent visible cue on a phone. The setting also leaves high-quality choices for later lists of that character.

**Proposed fix.** Keep the character-wide save unit and say so in the visible control or nearby text before it acts. Show which plans or how many materials are affected and keep the existing single Undo.

**Evidence.** The settings screenshots label the control “High quality for every material”. settingsSheet puts character scope only in a title. hqAllEdit replans all the character’s lists and saves by character and item at lists.js:536–545. This wide scope is intentional in the design, while the list settings sheet implies a narrower scope.

Technical: [tracker/command-center/src/lists/lists.js:1344](../../../../tracker/command-center/src/lists/lists.js#L1344)

### MINOR — Wanted calls an earned currency a purchase

A player recording earned scrip is invited to buy it and asked how many they bought. That contradicts the same drawer’s market warning and can make a new player look for a way to buy it.

**Proposed fix.** Show an earned or acquired action for currency in Wanted. Use that wording in the quantity prompt and undo text while retaining the same stock bookkeeping.

**Evidence.** Chromium at both widths with 200 Skybuilders’ Scrip as a wanted entry. Its drawer simultaneously says “This is a currency: it is earned, not bought” and offers “Bought it”. Pressing it asks “How many did you buy?”. The currency remains out of the market section and its stock update uses the normal safe path.

Technical: [tracker/command-center/src/lists/lists.js:1186](../../../../tracker/command-center/src/lists/lists.js#L1186)

### MINOR — Phase tabs omit currency that still has to be earned

A phase can look finished in the step strip while there is still earned currency due for a trade. For project lists the tab is the main summary of the phase.

**Proposed fix.** Display a phase’s nonzero To earn count alongside its get and craft counts. Keep amounts calculated from the phase share and keep the character-total label distinct.

**Evidence.** figures calculates an earn amount for every share, but stepsHtml prints only get and craft. In a phase whose remaining row is seven Skybuilders’ Scrip, the tab consequently reads “0 to get · 0 to craft” while To get lists seven to earn. The project picture exposes the same missing category with Ixali Oaknot under the phase workflow.

Technical: [tracker/command-center/src/lists/lists.js:950](../../../../tracker/command-center/src/lists/lists.js#L950)

### MINOR — Another tab can erase a draft still being typed in the settings sheet

A player can lose what they have typed for a new step while the sheet remains open and appears intact. Saved list and stock data survived the reproduction.

**Proposed fix.** Keep unsubmitted input per list and sheet when another save or a resize redraws the page. Clear it when submitted or when the player closes the draft intentionally, and leave stored updates on other fields intact.

**Evidence.** Chromium at both sizes. Type an unsaved new step and change a different stock entry in a second Lists tab. The first sheet stays visible while the step field becomes empty after the second save arrives. The renderer records the input value at lists.js:1242 but only restores focus and the caret at lines 1259–1264.

Technical: [tracker/command-center/src/lists/lists.js:1259](../../../../tracker/command-center/src/lists/lists.js#L1259)

### MINOR — The ready tally can undercount lists that already have their own share

The dashboard can say a list has zero items ready even when its item is fully covered by stock assigned to that list. A player may duplicate work.

**Proposed fix.** Use the stock allocated to each list’s wanted entries for its ready tally. Cover repeated quantities in different lists and phases in the test.

**Evidence.** Worked example with two lists belonging to one character, each wanting one Bronze Ingot, and one ingot typed in stock. The first list is allocated the ingot, but readyCounts only counts it if the pooled line has no shortage. The pooled line is one short, so both cards get zero ready. This display logic also existed at the review baseline.

Technical: [tracker/command-center/src/lists/lists.js:1088](../../../../tracker/command-center/src/lists/lists.js#L1088)

### MINOR — Some distinct trade offers share the same saved selection

The player can choose an offer and get a different set of trade inputs. This is a pre-existing key limitation exposed by the redesigned Other offers drawer.

**Proposed fix.** Identify an offer by the full price and conditions within its quality. Keep old saved keys readable, and only resolve an ambiguous old key using the same former default or a visible prompt.

**Evidence.** In the shipped data, Mega-Potion and X-Potion each have distinct offers sharing the same key. One Mega-Potion offer uses one Potion. Another uses one each of Potion, Hi-Potion and Ether. Both have the same unknown seller, quantity and first payment item, so pickTrade returns the first match. Pinned Teamcraft shop 1769524 supplies these entries and names no seller.

Technical: [tracker/command-center/src/lists/engine.js:63](../../../../tracker/command-center/src/lists/engine.js#L63)

### MINOR — The window regression test can pass when a window disappears

The release can lose a timed source or its start time while the test still reports that the Lists and Tracker windows are equal.

**Proposed fix.** Keep the individual-node rule and add fixture coverage that proves each expected timed source is present with its full timing. On shared comparable items also check complete coverage of expected start times, with explicit exceptions for different sources.

**Evidence.** The baseline LD-3 asserted exact agreement with the old merged window. The candidate has a stated reason to move to per-spot windows, but its replacement checks only a subset and a maximum duration, skips untimed spots, and still increments its coverage counter if every spot is untimed. Replacing all windows with two zeroes still satisfies this test’s predicates. The loose-source finding above is a real gap this test cannot see.

Technical: [tracker/tests/lists-data.test.js:148](../../../../tracker/tests/lists-data.test.js#L148)

### MINOR — The design checks miss covering panels, readable clipping and route states

A green check does not catch the phone history obstruction or guarantee that the real gear and project examples fit the stated layout budget.

**Proposed fix.** Check usable space after both fixed surfaces, clipping of essential location and item data, and an expanded full undo history. Check the first-row budget on the real shopping and project fixtures, then test scopes or exceptions explicitly.

**Evidence.** DR1 subtracts only a fixed 64-pixel phone bar from viewport height, allows ellipses and clamps, and walks a short earlier-history fixture. C186 checks first-row placement on its shopping and vendor fixtures, but does not check actual visibility behind history. The committed photo fixture records 203 and 210 pixels for Get and Wanted. L2’s look and tap results cover its named fixture.

Technical: [tracker/command-center/check.js:8209](../../../../tracker/command-center/check.js#L8209)

### MINOR — Copy name is missing on leftover and already-crafted rows

A player looking up an item that remains in stock or has just been crafted must copy it by hand or find it again in another view.

**Proposed fix.** Expose Copy name from the same row opener or a quiet accessible copy action for these two row types, and include them in the check.

**Evidence.** The helper uses the clipboard and its existing fallback on open shopping, craft and Wanted rows. Left over at lists.js:777–784 and Already crafted at lists.js:855–856 use different renderers with no opener or copy action. C185 exercises only the three rows that use the helper.

Technical: [tracker/command-center/src/lists/lists.js:777](../../../../tracker/command-center/src/lists/lists.js#L777)

## Screen-by-screen comparison

I reviewed the 27 built pairs and the 17 approved pairs at 1,440 px light and 360 px dark, plus nine pairs from the rejected version. The build directory contains 54 pictures. The two screenshot sizes have different scale and crop conventions, so the notes distinguish layout effects that can be seen in the UI from cut edges in section-only captures. Later owner decisions take precedence over the mock-ups, including quiet outlined row actions, the adjacent chevron and removing a single-entry rail.

| Built pair | Approved comparison | Desktop light and phone dark |
| --- | --- | --- |
| lists | lists | The cards now fill the desktop ledger and stack coherently on the phone. Combined view still reads as available for every character, even if there is only one list or no eligible selection. |
| lists-empty | lists-empty | The decoration and headline establish the family on both. On the phone the main action comes after three instructional rows and requires a scroll at 800 px. Its placement follows the approved long layout. |
| head | get | Desktop has a clear character-total label. The three narrow phone tallies crowd the title and leave the scope implicit. The data version is present. |
| get | get | The main ledger is a substantial improvement at both sizes. Desktop has a wall of controls and no merchant subtotal. The phone loses important node text and the thin zone headings are hard to scan. |
| get-open | get-open | The merchant drawer is a square, themed continuation of the ledger in both. Desktop repeats the reason at rest and open. The phone drawer puts the stock stepper and copy within reach. |
| get-gather | get | Zone and aetheryte grouping are new. The desktop can carry route detail, while the phone drops node name and some context. Several tiny area and teleport lines are hard to distinguish. |
| get-gather-open | get-open | The role-colored drawer looks native. On the phone it is needed to recover the Rose Garnet Ore node name and folklore requirement. The first visible row in the section-only capture is cut by the capture boundary. |
| get-crystals | get | Crystals visibly form their own ledger, keeping the Gather section readable. Desktop names the selected nodes. The phone presents several job icons while its short row may leave the selected job unclear. |
| get-earn | get | Earned items get a separate cool-colored group on both sizes. Desktop repeats the same explanatory sentence on each row. The phone count and heading do the work with less repetition. |
| get-vendors | get | Grouping is useful on both sizes, but city and seller text is dense. No desktop merchant subtotal and very little room for long place names on the phone. |
| craft | craft | The job work order and outline primary fit the house. Desktop book, star and warning boxes repeat. On the phone the short book warning competes with wrapped gear names. |
| craft-open | craft-open | The opened drawer keeps the detailed book warning. Its quality choice is far to the right on desktop, while the phone must fit labels and actions around a narrow selector. |
| craft-hq | craft-open | Both show the two jobs on Ra’Kaznar Ingot. The counted recipe explanation is in the open drawer and the desktop high-quality checkbox is visually separated from Get it by. |
| wanted | wanted | The list and result ledger hold together. The project and ordinary hits share the Amount field. The phone result area moves Wanted rows below the fold and repeats ordinary-quality text. |
| wanted-open | wanted | The desktop drawer feels like a plain form. Phone keeps the important actions reachable but clips the search hint and hides edits behind a generic link. |
| left | left | The work ledger and leftover sentence are much cleaner. The candidate picture depicts Left over, while the approved one also shows Not in your typed stock. The latter appears in the source and fixture tests. The same leftover amount appears in its block and sentence. |
| project | steps | The phases reuse the house ledger. On the phone Phase 2 and Phase 3 sit beyond the scroll edge, and the larger character counts visually dominate the project’s own totals. |
| steps | steps | Its smaller counts describe each share, with no earn figure. The desktop hand-in button has dropped below the strip and the phone button does not span its row. |
| combined | combined | Desktop keeps the character label, the held-stock note and the three utility links. The phone truncates the combined title early and fills much of the row with name, icon and repeated way stamp. |
| settings | settings | The controls are folded into a familiar sheet at both sizes. The new bulk action and switch need clearer visible scope and state. |
| order | order | The themed, numbered ladder follows the mock-up at both sizes. The longest two entries repeat their labels. On the phone the footer and fourth rung take the last space in view, with the fifth rung reachable by scrolling. |
| log | log | The fields are in the approved order and the answer and recipe ledger are clear at both sizes. The tabs disappear with a single entry, as the owner later requested. The count block says “crafts”, where the mock-up says “to make”. |
| log-which | log-which | The picker retains the full-width answer rows and right-hand counts at both sizes. The light version has substantial empty graph paper below, consistent with the mock-up for a short choice. |
| restored | restored | The distinctive dashed recovery frame survives. On both sizes the current action and open character select weaken the hierarchy, especially on the phone where the two actions nearly touch. |
| patch-closed | patch and later owner decision | On desktop the note becomes a compact strip. It wraps to two lines on the phone and pushes the ledger down. |
| patch | patch | The open strip is understandable and lists the actual recipe change. The desktop and phone notices have a less distinctive treatment than the approved wash. The phone gives up much of the first view while the details are open. |
| status | status | The normal status is visibly quieter than the rejected top-of-page buttons. The expanded history grows across the ledger at both sizes and can exceed the whole phone viewport. |

Technical: docs/design-rules.md · docs/lists-look-spec.md · docs/lists-redesign/before · docs/lists-redesign/after · docs/lists-redesign/build

## What checked out

- **Game facts.** I compared all 13,936 included item flags against the pinned Item sheet. There were zero differences for market-board category. Fire Shard has category 58 and Bronze Ingot 48. Poetics, Purple Crafters’ Scrip, Orange Gatherers’ Scrip and Skybuilders’ Scrip have category zero even though the sheet’s untradable field is false. The built data keeps them out of market purchases. The earned group and tally partition the default currency needs correctly. [Item sheet](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/Item.csv)
- **Gathering facts.** I checked five sheet nodes against the map conversion and the built data. Earth Shard’s Mature Tree in Lower La Noscea is at 32.2, 16.1, Wind Shard’s Rocky Outcrop in Northern Thanalan at 21.7, 28.1, Ice Shard’s Mineral Deposit in South Shroud at 16.1, 19.5, Water Shard’s Lush Vegetation Patch in Western Thanalan at 24.6, 18.8, and Spruce Log’s Unspoiled Mature Tree in Coerthas Central Highlands at 29.2, 12.8. The two Helmet Crab fishing spot names and levels agree with the FishingSpot sheet, with its coordinates mapping to the displayed positions. I also compared the level for placed Teamcraft nodes to the sheet and found no differences. The placed-node time and grouping read the chosen source together, rather than a merged window across locations. [ExportedGatheringPoint](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/ExportedGatheringPoint.csv) · [GatheringPointName](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/GatheringPointName.csv) · [Map](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/Map.csv) · [FishingSpot](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/FishingSpot.csv)
- **Books and crafters.** The game sheet links recipe 30241 to Master Armorer I and the Courtly Lover’s Trousers of Scouting recipe 37879 to Master Leatherworker XII. The planner reads the Tracker ticks by exact book name. The normal job rows and Wanted use all distinct crafting jobs, including the eight-job data cases. Crafting-log targets keep their recorded recipe, and ordinary alternative recipes use the saved choice or the lowest-level default. The known book exclusion behavior is documented. [Recipe](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/Recipe.csv) · [SecretRecipeBook](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/SecretRecipeBook.csv)
- **Workshop amounts.** Shark-class Bow’s three phases agree with sequence 530, part 1700, processes 800–802 and their linked supplies. Phase 1 wants 30 Steel Ingots, 30 Steel Rivets, 30 Cobalt Joint Plates and 18 Cobalt Ingots. Phase 2 wants 30 Steel Rivets, 30 Steel Joint Plates and 12 Darksteel Ingots. Phase 3 wants 9 Ancient Lumber, 30 Mythril Rivets and 30 Silver Ingots. Bronco-type Hull’s three phases also agree with sequence 500, part 300 and processes 500–502. The build keeps 40 submarine and 28 airship parts. Creating a project is one change with one undo. A normal hand-in asks first and accounts for the chosen phase’s allocated stock. [CompanyCraftSequence](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/CompanyCraftSequence.csv) · [CompanyCraftPart](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/CompanyCraftPart.csv) · [CompanyCraftProcess](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/CompanyCraftProcess.csv) · [CompanyCraftSupplyItem](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/44948e4cda5846eab0baa9872122a888fcc4f1b1/csv/en/CompanyCraftSupplyItem.csv)
- **Planner behavior.** The default way still prefers a valid gil-only merchant for any recipe level, subject to quality and explicit player overrides. The vendor grouping shows a compatible equal-price seller without changing the underlying quote. Reputation-gated gil offers are a documented limit. Bought it remains reachable from craft drawers after partial progress. The stock operation adds the chosen item and units and only changes the applicable must-craft flags. It preserves the gathered ingredients. Crystals, character-specific quality settings and the normal clipboard flow have independent code paths and corresponding checks. The displayed data version reads the build stamp. The refresh checklist tells the maintainer to preserve the old data and move the relevant pins together. Patch notices still cover recipe changes rather than offer and node changes, as recorded in the build plan.
- **Save and prices.** The save document and merge algorithms keep their prior format in this diff. I found no path in the changed flows that silently drops saved Lists entries during an unanswered cross-device clash. The model retained competing changes, the old-device compatibility cases ran, the new workshop test covers one undo, and the existing save transaction refuses an undo that would leave a new orphan. On the exercised UI, a second tab lost no stored stock while the first sheet did lose its unsent draft. Submersibles source, built module, data and prices tests are unchanged relative to the baseline. Lists still uses its own price-cache keys and the unchanged isolation assertion in the browser check verifies the Submersibles record byte for byte. I reviewed game and player text interpolation. Names, places, prices, books, patch text and status messages are escaped in their HTML contexts or supplied as text, and built paths, internal IDs and numeric quantities are taken from constrained or validated sources.
- **Test changes.** The six-role coverage moved from the old look test to the role suite and browser measurements, with contrast across 21 themes, wording, focus and tap rules covered by the replacements. Most changed browser assertions move through the new drawers or sheets. The market empty state assertion intentionally became stricter. The changed window assertion and the sync and layout coverage gaps are findings above. The existing model assertions stayed in place.

Technical: tracker/command-center/check.js · tracker/tests/lists-model.test.js · tracker/tests/lists-roles.test.js · tracker/tests/lists-patch.test.js · tracker/data/SOURCES.md · docs/STATE.md

## Verification and limits

I installed the locked dependencies with `npm ci` in a separate test copy and ran `npm run test:unit` twice with repository history available. Both completed the model’s cases and failed its 20-second engine wall-clock assertion at about 23.1 and 24.0 seconds. The baseline failed the same assertion at 24.0 seconds in this environment. The unit command stopped at that assertion, so I ran its remaining suites directly. Across the unit command and the remaining suites, 615 of 616 checks passed and that time assertion was the sole failure. No model invariant failed.

I ran focused Chromium checks of the built candidate at both widths, including actual separate tabs sharing a local save and a controlled price response. Game sheet comparisons used the pinned raw sources. I inspected the named browser checks and their committed evidence. I did not run the full browser suites, the publisher or offline cache install, a physical phone or another browser, a live price request, or a real two-device cloud sync.

In the second review pass I repeated the route example with no other lists, separated the phone overlay from screenshot cropping, traced the formatter to its real sync caller, and reran the baseline timing assertion to avoid attributing the local time failure to the redesign.
