# TodoMVC with Orange Sherbet

A standalone [TodoMVC](https://todomvc.com) built the way this repo's `/todos`
page works: [defo](https://github.com/icelab/defo) binds a view function to the
root node, and [Orange Sherbet](https://github.com/makenosound/orange_sherbet)
compiles the ERB templates to the JS render functions the view imports.

There is no bundler. The compiled templates are plain ES modules, defo loads from
a CDN, and `todomvc.js` runs directly in the browser.

```
templates/*.html.erb  ──orange_sherbet──▶  compiled/*.js  ──imported by──▶  todomvc.js (defo viewFn)
```

## What it shows

- One ERB template (`todo_list`) renders a partial (`todo_item`) — the `render`
  call becomes a normal JS `import` in the compiled output.
- Ruby in the templates compiles to inline JS: `todo.completed ? "completed" : ""`,
  `active == 1 ? "item" : "items"`, attribute reads, `each`, conditionals.
- The viewFn holds state (todos, filter, editing) and re-renders the list and
  footer from the compiled templates on every change — add, toggle, edit
  (double-click), delete, toggle-all, clear-completed, filters (`#/active`,
  `#/completed`), and localStorage persistence.

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
