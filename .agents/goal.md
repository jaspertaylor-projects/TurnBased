# Turn Based Goal

It is our goal to be the go-to online site for board game devs.  

We want board game developers to be able to come to our site, design a board game,
order a physical prototype.  Make a playable online version of their game, and playtest their game online.  Eventually, we would like to be able to sell peoples board games both digitally and physically.

## Milestones

1. Board game design + physical order
    1. A version controlled way to design components, keep track of rules etc.
    2. Intelligent board game design components for making (boards, cards, tiles, dice, etc) made from subcomponents tracks, spaces, lines, and incorporating templating for repeat components and decks of cards etc.    
    3. AI help for writing rules, and making art assets
    4. Each component should come from our webscraped catalog of assets, and we will handle the ordering on the backend for them.  The bleed zone and everything shoudl be very clear to the user.
    5. We have a pretty solid 3rd party API that can be used read about it here .agents/third-party-catalog-pricing-api.md
    6. The project designer should feel simple and fun to use

2. AI Board game engine 
    1. To be desinged later, but we need to be able to keep our assets as interactable items so that they can seemlessly be brought about into a digital version of the game.
    2. Keep this direction in mind that each board game will eventually need to be playable online when making coding decisions for board game designer + physical order milestone


3.  Online economy 
    1. To be designed later, but keep in mind that we will need to be able to have robust user accounts of different types (designer/playtester/user ) etc.   


## Version Control Branching Map Plan

This section captures the agreed direction for the editor version-control page
so another agent can continue cleanly if work is interrupted.

The version-control page should become a visual branching map on a grassy
fantasy backdrop. Each version checkpoint is a space/node on the map. The user
selects the current checkpoint by dragging a meeple marker onto a node. The
meeple should use the existing app favicon asset at
`apps/web/public/favicon.png`.

Use a local version graph as the primary UI source of truth. Each graph node
should store enough data for branch switching to work even without remote git:

- branch/version name
- numbered commit label
- commit SHA or local SHA
- parent commit SHA
- project snapshot
- workspace files
- sync status such as `local`, `synced`, or `sync_failed`
- optional remote branch name
- optional real remote SHA

The local graph must let the user move backward, forward, and across branches
by selecting nodes on the map. Restoring a node should restore that node's
project snapshot and workspace files. Prefer a confirmation before destructive
restores so accidental drops do not silently replace the workspace.

Branch/version naming should be user-friendly. The project title remains the
game name, and a subline beneath it should show the active version name, for
example:

`My Super Game`

`version: initial musings`

Saving on a version should create numbered commits using the active version
name:

- `initial musings 1`
- `initial musings 2`
- `initial musings 3`

Creating a new version such as `powerful spells` should create a new branch in
the local graph from the currently selected node. Its commits should then be
numbered independently:

- `powerful spells 1`
- `powerful spells 2`

There should be a save icon in the editor sidebar to the right of the project
name. Clicking it should commit the whole current workspace to the active
version branch. To guarantee that every save produces a distinct file change
and SHA, update a per-project/version marker file such as
`versions/<branch>.json` with the branch name, version number, timestamp, and
current node id.

Remote git through `git-proxy` is desirable, but should be treated as a backing
sync/provenance layer rather than the thing required for the UI to work. The
recommended implementation is hybrid:

- create/update the local graph immediately for responsive branch switching
- when signed in and a remote project exists, call `git-proxy` to create the
  corresponding real branch/commit
- store returned remote branch/SHA on the local graph node
- if remote sync fails, keep the local node and mark it `sync_failed`
- allow retrying remote sync later

Do not rewrite history. If the user restores an older node, edits, and then
saves, prompt them to create a new branch/version from that node rather than
silently replacing the old branch's forward history.
