# frozen_string_literal: true

# Guards the compiler's subset gate and its compile-time lowering decisions.
# End-to-end output correctness (vs the Renderer) is covered by conformance_spec.
RSpec.describe Sherbet::Compiler do
  # compile returns [js, source_map]; these specs assert on the JS.
  def compile(src) = described_class.compile("t", src).first

  it "preserves Ruby truthiness for || rather than emitting native JS ||" do
    expect(compile(%(<%= a || "x" %>))).to include("__truthy")
  end

  it "rewrites whitelisted methods to inline JS" do
    expect(compile("<%= title.upcase %>")).to include("title.toUpperCase()")
    expect(compile("<% if xs.any? %><% end %>")).to include("xs.length > 0")
  end

  it "compiles attribute reads to plain property access" do
    expect(compile("<%= post.title %>")).to include("post.title")
  end

  it "emits a normal import for render partials" do
    js = compile(%(<%= render "post_card", post: post %>))
    expect(js).to include('import post_card from "./post_card.js";')
    expect(js).to include("post_card({ post: post })")
  end

  describe "Tier 1 constructs" do
    it "compiles defined? to an undefined check" do
      expect(compile("<%= defined?(x) %>")).to include("(x !== undefined)")
    end

    it "compiles safe navigation to optional chaining" do
      expect(compile("<%= user&.name %>")).to include("user?.name")
    end

    it "compiles local assignment to a let declaration" do
      js = compile(%(<% x = "a" %><%= x %>))
      expect(js).to include("let x;").and include("x = \"a\";")
    end

    it "compiles a guarded assignment (modifier if)" do
      expect(compile(%(<% x = "a" if cond %>))).to include("if (__truthy(cond)) { x = \"a\"; }")
    end

    it "translates array/hash/json methods to JS" do
      expect(compile("<%= xs.uniq %>")).to include("[...new Set(xs)]")
      expect(compile("<%= h.keys %>")).to include("Object.keys(h)")
      expect(compile("<%= h.to_json %>")).to include("JSON.stringify(h)")
    end
  end

  describe "subset gate" do
    it "rejects statements outside the subset" do
      expect { compile(%(<% content_for :title, "Blog" %>)) }
        .to raise_error(Sherbet::Unsupported, /Unsupported statement/)
    end

    it "rejects methods outside the whitelist" do
      expect { compile(%(<%= s.gsub("a", "b") %>)) }
        .to raise_error(Sherbet::Unsupported, /not in the portable subset/)
    end
  end
end
