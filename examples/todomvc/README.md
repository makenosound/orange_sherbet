# TodoMVC with Orange Sherbet

A standalone [TodoMVC](https://todomvc.com) built the way this approach intends:
[defo](https://github.com/icelab/defo) binds a view function to every node that
enters the DOM, and [Orange Sherbet](https://github.com/makenosound/orange_sherbet)
compiles the ERB templates to the JS render functions the views import.

There is no bundler — the compiled templates are plain ES modules, and `defo`
and `morphlex` load from a CDN via the import map in `index.html`.

```
templates/*.html.erb ──orange_sherbet──▶ compiled/*.js ──imported by──▶ the view functions
```

`templates/` holds the ERB and `compiled/` its generated JS; the app itself
lives in `app/` — a small store and one view function per element:

| File | Role |
|---|---|
| `app/store.js` | the reducer + state + `dispatch`/`subscribe` (a shared singleton) |
| `app/app.js` | renders the whole list on every change and morphs it onto the DOM |
| `app/new_todo.js` | the header input — dispatches `add` |
| `app/toggle_all.js` | the "mark all complete" checkbox — dispatches `toggleAll` |
| `app/todo_item.js` | one `<li>` — dispatches toggle/destroy/edit/save/cancel; focuses on edit |
| `app/main.js` | registers them all with defo |

## What it shows

- **One shared store, no event plumbing.** State lives in `store.js`; every view
  imports `dispatch` and calls it directly (`dispatch({ type: "toggle", id })`).
  There are no CustomEvents bubbling up — the store isn't trapped in a closure,
  so children just dispatch. `app.js` `subscribe`s and re-renders on change.
- **The app renders the whole list; morphlex reconciles it.** On each change
  `app.js` renders the entire `<ul>` from the templates and
  [morphs](https://github.com/yippee-fun/morphlex) it onto the live list — so the
  app owns no keyed add/remove/reorder logic, morphlex does. A todo being edited
  is skipped by the morph (`beforeNodeVisited`, when it's editing in both the old
  and new render), so an in-progress edit survives an unrelated change.
- **defo owns the item views.** As morph adds/removes `<li>`s, defo binds a
  `todoItem` to each and runs `destroy` for each that leaves — no manual wiring.
- **Edit mode is state, rendered by morph, focused by defo.** `editing` (the id
  being edited) is in the store. The template renders the `editing` class from
  it, so morph shows the field; the one thing morph can't do is focus, so the
  item's `update` does that when its props say it's editing.
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
