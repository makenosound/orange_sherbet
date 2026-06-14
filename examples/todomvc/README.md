# TodoMVC with Orange Sherbet

A standalone [TodoMVC](https://todomvc.com) built the way this approach intends:
[defo](https://github.com/icelab/defo) binds a view function to every node that
enters the DOM, and [Orange Sherbet](https://github.com/makenosound/orange_sherbet)
compiles the ERB templates to the JS render functions the views import.

There is no bundler — the compiled templates are plain ES modules, and `defo`
and `morphlex` load from a CDN via the import map in `index.html`.

```
templates/*.html.erb ──orange_sherbet──▶ compiled/*.js ──imported by──▶ todomvc.js (defo viewFns)
```

## What it shows

- **The root renders the whole list; morphlex reconciles it.** `todomvcViewFn`
  holds the todos + filter in a closure with a pure `reduce`, and on each change
  renders the entire `<ul>` from the templates and
  [morphs](https://github.com/yippee-fun/morphlex) it onto the live list — so the
  root doesn't own any keyed add/remove/reorder logic, morphlex does. A todo
  being edited is skipped by the morph (`beforeNodeVisited`, when it's editing in
  both the old and new render), so an in-progress edit survives an unrelated
  change.
- **defo owns the item views.** As morph adds/removes `<li>`s, defo binds a
  `todoItem` view to each one and runs `destroy` for each that leaves. The item
  owns one todo's behaviour — toggle / destroy / double-click-to-edit — and
  emits bubbling intents (`todo:toggle` / `todo:save` / `todo:destroy`) the root
  reduces. The main reducer is event-driven, not attribute-driven.
- **Edit mode is state, rendered by morph, focused by defo.** `editing` (the id
  being edited) lives in the reducer state. The template renders the `editing`
  class from it, so morph shows the edit field; the only thing morph can't do is
  focus, so the item's `update` does just that when its props say it's editing.
  Enter emits `todo:save`, Escape `todo:cancel`.
- **Ruby compiles to inline JS.** `todo.completed ? "completed" : ""`,
  `todo.to_json` (→ `JSON.stringify`), attribute reads, `each`, conditionals —
  and `render "todo_item_content"` becomes a JS `import` in the compiled output.

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
