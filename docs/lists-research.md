# Lists: what Teamcraft's lists get wrong, and what ours must do instead

Research for the Lists module (blueprint phase 3), done 2026-11-21 at the owner's request: "check ffxiv teamcraft's lists
and complaints online that the community have had on them, plus limitations that teamcraft itself has raised, and see if
we can incorporate all those fixes in my version". The owner's decisions on it are recorded in `docs/STATE.md`
(2026-11-21).

## How this was gathered, and how far to trust it

- Web search only. The session's network refused direct fetches of the Teamcraft wiki and of issue indexes, so every
  point below comes from search-result summaries of the pages, not from the full threads.
- Several issues are old (2017 to 2021) and may be fixed in Teamcraft today. They are used as lessons on what to design
  against, not as claims about the current Teamcraft.
- Community threads (Reddit, forums) were thin in search; most evidence is from Teamcraft's own issue tracker and wiki.

## 1. Wrong totals

| Teamcraft problem | Source |
| --- | --- |
| A recipe that yields more than one item does not lower the material totals as crafts are recorded | [#983](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/983) |
| Removing a finished item made a completed requirement go from 9/9 back to 3/9 | [#2971](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2971) |
| Materials stay marked "acquired" after another craft used them up | [#1721](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1721) |
| Trades that are not one for one are counted as one for one | [#559](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/559) |
| Crafted collectables do not count toward the list | [#2896](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2896) |
| "Required HQ" lost when a list is shared or copied | #3113 (title only, from the [issue index](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues)) |
| Early bugs: removing an item leaves its materials behind (#40); clearing the amount deletes the item (#39) | issue index summary |

**Ours:** a list stores only what the player wants, what they have, and how they choose to get each item. Every total is
recomputed from those and the current game data on every change; nothing is added or subtracted step by step. The
computation is one pure function with a permanent randomized model test (like `tracker/tests/subs-model.test.js`): a
multi-yield recipe rounds crafts up; an intermediate already held removes its whole sub-tree; removing an item never
raises another item's remaining need; HQ and collectable requirements stay on the item; a trade's real ratio is used.

## 2. Buy, craft or gather

| Teamcraft request | Source |
| --- | --- |
| Per-list setting: buy or gather when both are possible | [#1119](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1119) |
| Prefer the vendor price when it is lower than crafting | [#543](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/543) |
| Ignore tribal vendors | [#2479](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2479) |
| Ignore vendor items in a list | [#2951](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2951), [#2622](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2622) |
| A third-party plugin added "craft vs buy" per row because lists lack it | [KupoTradeMaster](https://github.com/HanamiGG/KupoTradeMaster) |

**Ours:** every row has a "get it by" choice (craft, vendor, market, gather, already have); a list-level preference sets
defaults (for example "gather when possible", "never tribal vendors"); totals and the shopping section follow at once.
Vendor data is already in the repository (Teamcraft `shops.json`). Market prices come from the shared price service
(owner decision 3A).

## 3. Large lists are slow

| Teamcraft problem | Source |
| --- | --- |
| The page slows with every item; lists are tied to a live shared database | Teamcraft wiki; [#922](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/922) (offline lists asked for) |
| Close to 100% CPU on large lists in the desktop app | [#1196](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1196) |
| A large list can exceed 50,000 page elements | [#2400](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2400) |
| Splitting lists for speed, then asking to combine them again | [#1336](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1336), [#2064](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2064) |

**Ours:** computed on the device, no live database; sections start collapsed and only open sections are drawn; a
combined view shows several lists against one inventory, so nobody splits or merges lists for speed.

## 4. Lists go stale after a patch

Teamcraft's troubleshooting page tells players to press "Update list to latest Teamcraft Version", and there is a
"Regenerate list" action ([troubleshooting](https://wiki.ffxivteamcraft.com/troubleshooting),
[#576](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/576)): lists store a computed recipe tree.

**Ours:** the tree is never stored; it is rebuilt from current data whenever the list opens. If a patch changes a recipe
in a list, the app says what changed and keeps the player's progress.

## 5. Lost lists and sharing

| Teamcraft problem | Source |
| --- | --- |
| Lists without an account live in the browser and vanish in a private window or with cleared history | [Prima guide](https://primagames.com/tips/how-to-use-ffxiv-teamcraft-final-fantasy-teamcraft-guide) |
| Shared lists could be reset or altered ("trolled"), leading to a permissions system | [#277](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/277) |
| Permission duplicates | [#1661](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1661) |

**Ours:** lists live in the shared save and sync through the existing OneDrive sync, under the same rule as everything
else: nothing is deleted across devices without the player's choice. Sharing (blueprint phase 7) gives a copy by link or
file, so no one can damage another player's list.

## 6. Multi-phase projects, order and clutter

| Teamcraft request | Source |
| --- | --- |
| Company Workshop projects mix every phase's materials; the maintainer's answer was one list per phase | [#2269](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2269) |
| One-tap "hide completed" instead of the layout editor | [#675](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/675) |
| The layout system and overall feature load confuse users | [Square Enix forum thread](https://forum.square-enix.com/ffxiv/threads/344029) and Reddit comments |

**Ours:** a list can have steps (phases), each with its own totals and leftovers carried forward; a crafting-order view
puts intermediate crafts before final ones, grouped by job; "hide completed" is one button; one good default view, few
settings, no layout editor.

## 7. From the crafting log, to the Atelier

Players asked for a list built from a whole crafting-log tier ([forum](https://forum.square-enix.com/ffxiv/threads/344029/?page=2))
and for the recipe finder to add crafted items back ([#1909](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1909)).

**Ours:** the Tracker already knows each character's missing crafting-log entries, so "make a list from what is missing on
this log page" comes almost free, with "Solve in the Atelier" on every craft. Timed gathering nodes carry their next
window (`tracker/data/conditions.json`); full alarms stay in the Gathering module.

## 8. What we will not copy

| Teamcraft feature | Why not | Ours instead |
| --- | --- | --- |
| Inventory read automatically from the game's network traffic | The project never reads the game. It is also Teamcraft's most fragile area: PC desktop app only, broken by VPNs and antivirus, wrong retainer contents ([#1243](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1243)), the 999-stack bug ([#3311](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/3311)), missed scrip purchases ([#1578](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1578)) | Fast typed entry ("I have N", plus and minus, "I have all"); ticking a craft done consumes its materials. The page says plainly that entry is manual. |
| Live shared editing, teams, permissions | Needs a server | Share a copy by link or file |
| Uploading market prices to Universalis | Comes from reading the game | Prices are only read |
