# Orange Sherbet

*Write your template once in ERB; render it on the server and in the browser.*

Orange Sherbet compiles ERB templates — written in a small, portable subset of Ruby —
into self-contained JavaScript modules. The same `.html.erb` renders on the
server (real Ruby via Erubi) and re-renders in the browser from the compiled JS,
with identical output by construction.

It parses the Ruby inside tags with [Prism](https://github.com/ruby/prism) (the
real Ruby parser, not an approximation) and emits JS through an AST + printer, so
the output has correct operator precedence, escaping, and a source map back to
the `.html.erb`.

```
.html.erb ──▶ Scanner (ERB + Erubi trim) ──▶ Compiler (Prism → JS AST) ──▶ Printer ──▶ .js + .js.map
                                                                              │
server: OrangeSherbet::Renderer (Erubi) ──────────────────── identical output ─────┘
```

## Why

The semantics are resolved at compile time, so the browser ships almost nothing:
method calls become inline JS (`id.upcase` → `id.toUpperCase()`), attribute reads
become property access, `each` becomes `.forEach`, partials become `import`s, and
the only runtime is three tiny inlined helpers (HTML escape, nil-safe `to_s`, and
Ruby truthiness — `0` and `""` are truthy, unlike JS). There is no interpreter or
parser in the bundle.

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
# → app/assets/js/templates/<name>.js (+ .js.map) per template
```

The generated module default-exports a render function:

```js
import card from "./card.js";
card({ post }); // => HTML string
```

## The portable subset

Supported inside tags: attribute reads, `if`/`elsif`/`else`/`unless`, ternary,
`&&`/`||` (with Ruby truthiness), comparisons, string interpolation, `each` /
`each_with_index`, local assignment (incl. `x = v if cond`), `defined?`, safe
navigation (`&.`), `render` partials, and a whitelist of value methods
(`upcase`, `join`, `any?`, `map`-free array/hash helpers like `uniq`/`keys`/
`sum`, `to_json`, …).

Anything outside the subset — `gsub`/regex, `rand`, arbitrary method calls,
blocks other than `each` — raises `OrangeSherbet::Unsupported` at compile time rather
than miscompiling. Method names shared across types (`length`, `empty?`,
`include?`) resolve to the string/array reading; Hash uses explicit
`keys`/`values`.

## Development

```bash
bin/setup
bundle exec rspec        # pure-Ruby specs + a cross-language conformance
                         # spec that renders in Node and diffs against Ruby
                         # (skipped if `node` isn't on PATH)
bundle exec standardrb
```

## License

Available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
