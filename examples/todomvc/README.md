# TodoMVC with Orange Sherbet

A standalone [TodoMVC](https://todomvc.com) built the way this approach intends:
[defo](https://github.com/icelab/defo) binds a view function to every node that
enters the DOM, and [Orange Sherbet](https://github.com/makenosound/orange_sherbet)
compiles the ERB templates to the JS render functions the views import.

There is no bundler — the compiled templates are plain ES modules, and `defo`
loads from a CDN via the import map in `index.html`.

```
templates/*.html.erb ──orange_sherbet──▶ compiled/*.js ──imported by──▶ todomvc.js (defo viewFns)
```

## What it shows

- **Each item is a defo component, rendered via `update`.** Every `<li>` carries
  its todo as a `data-defo-todo-item` JSON attribute — that's its props. defo
  calls the item's `update(todo)` whenever the attribute changes, and the item
  re-renders its *own* content (Orange Sherbet's `todo_item_content`). So a
  toggle re-renders only that one item, through defo's update mechanism:

  ```
  reduce ─▶ root sets the <li>'s data-defo-todo-item ─▶ defo ─▶ item.update(todo)
  ```

- **The root owns state and reconciles the list.** `todomvcViewFn` holds the
  todos + filter in a closure and a pure `reduce`. It receives bubbling intents
  (`todo:toggle` / `todo:save` / `todo:destroy`) — the main reducer is
  event-driven, not attribute-driven — and on each change reconciles the `<ul>`
  by id: it sets each existing `<li>`'s attribute (→ that item updates), creates
  `<li>`s for new todos, and removes them for gone ones. defo binds/destroys an
  item view per `<li>` as it enters/leaves.
- **Items hold no state — even edit mode.** Props flow down via the attribute
  (`update`), intents flow up via events. `editing` is part of the reducer
  state: double-click emits `todo:edit`, the reducer records which todo is being
  edited, and that flows back to the item as `editing: true` in its props.
  `update` focuses the field on the false→true transition only, so an unrelated
  re-render never resets an in-progress edit. Enter emits `todo:save`, Escape
  `todo:cancel`.
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
