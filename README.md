# Orange Sherbet

*A little sugar for your ERB*

Orange Sherbet compiles ERB templates (written in a subset of Ruby) into self-contained JavaScript
modules – allowing you to render the same content on the server and in the browser.

## Usage

```ruby
js, source_map = OrangeSherbet.compile("card", File.read("card.html.erb"))
```

Render the same template on the server:

```ruby
renderer = OrangeSherbet::Renderer.new("app/templates/portable")
renderer.render("card", post: post) # => HTML string, identical to the compiled JS
```

Compile a directory as a build step:

```bash
orange_sherbet compile app/templates/portable app/assets/js/templates
# → app/assets/js/templates/<name>.js (+ .js.map) per template, plus a shared
#   __runtime.js (the value helpers) that each template imports
```

The generated module default-exports a render function:

```js
import card from "./card.js";
card({ post }); // => HTML string
```

## Ruby subset

Supported inside tags:

- attribute reads
- `if`, `elsif`, `else`, and `unless`
- ternary statements
- `&&` and `||` (with Ruby truthiness)
- comparisons
- string interpolation
- `each` and `each_with_index`
- local assignment (incl. `x = v if cond`)
- `defined?`
- safe navigation (`&.`)
- `render` partials
- and an allowlist of value methods (`upcase`, `join`, `any?`, `map`-free 
  array/hash helpers like `uniq`/`keys`/`sum`, `to_json`, …).

Anything outside the subset raises `OrangeSherbet::Unsupported` at compile time.
