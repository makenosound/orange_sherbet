# frozen_string_literal: true

# Direct tests for the JS backend (AST constructors + Printer), independent of
# any Ruby/ERB lowering. These pin down the two things the printer owns:
# precedence-driven parenthesisation and string/template escaping.
RSpec.describe Sherbet::Js do
  include Sherbet::Js

  # Render an expression through the real statement path and return the JS.
  def render(expr)
    printer = Sherbet::Js::Printer.new
    printer.stmt({type: :append, expr: expr, line: nil}, 0)
    printer.output.sub(/\A__o \+= /, "").sub(/;\n\z/, "")
  end

  describe "parenthesisation from precedence" do
    it "wraps a looser child when the context binds tighter" do
      expect(render(j_member(j_binary("+", j_ident("a"), j_ident("b")), "foo"))).to eq("(a + b).foo")
    end

    it "does not add parens where precedence already allows" do
      expect(render(j_member(j_member(j_ident("a"), "b"), "c"))).to eq("a.b.c")
    end

    it "parenthesises a lower-precedence operator nested under a higher one" do
      expect(render(j_binary("+", j_ident("a"), j_binary("*", j_ident("b"), j_ident("c"))))).to eq("a + b * c")
      expect(render(j_binary("*", j_binary("+", j_ident("a"), j_ident("b")), j_ident("c")))).to eq("(a + b) * c")
    end

    it "does not wrap a ternary passed as a call argument" do
      expr = j_call(j_ident("__esc"), [j_ternary(j_ident("c"), j_str("x"), j_str("y"))])
      expect(render(expr)).to eq(%(__esc(c ? "x" : "y")))
    end
  end

  describe "escaping" do
    it "escapes string literals" do
      expect(render(j_str(%(he"llo\nworld)))).to eq('"he\\"llo\\nworld"')
    end

    it "escapes backticks and interpolation markers in template text" do
      expect(render(j_tpl(["a`b ${c}"]))).to eq("`a\\`b \\${c}`")
    end

    it "renders template interpolation parts" do
      expect(render(j_tpl(["x=", j_ident("v")]))).to eq("`x=${v}`")
    end
  end

  describe "source map" do
    it "produces a valid v3 map with embedded source" do
      printer = Sherbet::Js::Printer.new
      printer.line("line one")
      printer.stmt({type: :append, expr: j_ident("x"), line: 3}, 0)
      map = JSON.parse(printer.source_map("t.html.erb", "<erb source>"))
      expect(map["version"]).to eq(3)
      expect(map["sources"]).to eq(["t.html.erb"])
      expect(map["sourcesContent"]).to eq(["<erb source>"])
      expect(map["mappings"]).not_to be_empty
    end
  end
end
