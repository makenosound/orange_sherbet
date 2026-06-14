# TodoMVC with Orange Sherbet

A standalone [TodoMVC](https://todomvc.com) built the way this approach intends:
[defo](https://github.com/icelab/defo) binds a view function to every node that
enters the DOM, and [Orange Sherbet](https://github.com/makenosound/orange_sherbet)
compiles the ERB templates to the JS render functions the views import.

There is no bundler — the compiled templates are plain ES modules, and `defo` and
`morphlex` load from a CDN via the import map in `index.html`.

```
templates/*.html.erb ──orange_sherbet──▶ compiled/*.js ──imported by──▶ todomvc.js (defo viewFns)
```

## What it shows

- **Two view functions, narrow responsibilities.** `todomvc` (the root) owns the
  todos, filter, and persistence. `todoItem` is bound by defo to each `<li>` and
  owns one todo's interaction (toggle, destroy, double-click to edit) — it holds
  no state, just reads its id from the node and dispatches intents
  (`todo:toggle` / `todo:save` / `todo:destroy`) that bubble up to the root.
- **defo binds new nodes automatically.** As the list changes, defo binds
  `todoItem` to each `<li>` that enters the DOM and runs its `destroy` for each
  that leaves — no manual wiring.
- **Morphing, not innerHTML.** The root renders with Orange Sherbet and uses
  [morphlex](https://github.com/yippee-fun/morphlex) to patch the list in place,
  so defo only binds/destroys the items that actually changed, and a todo being
  edited (`data-editing`) is skipped by the morph so an in-progress edit survives
  a re-render triggered by another todo.
- **Ruby compiles to inline JS.** `todo.completed ? "completed" : ""`,
  `active == 1 ? "item" : "items"`, attribute reads, `each`, conditionals — and
  `render "todo_item"` becomes a JS `import` in the compiled output.

## Build

Regenerate `compiled/` whenever a template changes:

```bash
# from the gem root:
bundle exec orange_sherbet compile examples/todomvc/templates examples/todomvc/compiled

# or, with the gem installed:
orange_sherbet compile examples/todomvc/templates examples/todomvc/compiled
```

## Run

ES module imports need to be served over HTTP (not `file://`):

```bash
cd examples/todomvc
python3 -m http.server 8000
# open http://localhost:8000
```

## Test

The view functions have a small happy-dom test suite (the item view and the root
view are driven independently):

```bash
cd examples/todomvc
npm install
npm test
```
