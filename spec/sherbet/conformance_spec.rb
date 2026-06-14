# frozen_string_literal: true

require "tmpdir"
require "open3"

# The cross-language guarantee: a template rendered by Sherbet::Renderer (real
# Ruby via Erubi) and by the compiled JS (run in Node) must produce identical
# output. The Renderer is the source of truth; the compiler is held to it.
#
# Skipped when Node isn't available, so the pure-Ruby suite still runs anywhere.
RSpec.describe "cross-language conformance" do
  def templates_dir = File.expand_path("../fixtures/templates", __dir__)

  def data_dir = File.expand_path("../fixtures/data", __dir__)

  before(:all) do
    skip "node not available" unless system("node --version", out: File::NULL, err: File::NULL)
  end

  [["blog_list", "blog.json"], ["features", "features.json"]].each do |name, data_file|
    it "renders #{name} identically in Ruby and JS" do
      data = JSON.parse(File.read(File.join(data_dir, data_file)))
      ruby_out = Sherbet::Renderer.new(templates_dir).render(name, data)
      js_out = render_with_node(name, data)

      expect(js_out).to eq(ruby_out)
    end
  end

  # Compile every fixture template (so partials resolve via import), then render
  # the entry in Node with the same data.
  def render_with_node(entry, data)
    Dir.mktmpdir do |dir|
      Dir.glob(File.join(templates_dir, "*.html.erb")).each do |path|
        name = File.basename(path, ".html.erb")
        js, = Sherbet::Compiler.compile(name, File.read(path))
        File.write(File.join(dir, "#{name}.js"), js)
      end
      File.write(File.join(dir, "data.json"), JSON.generate(data))
      File.write(File.join(dir, "run.mjs"), <<~JS)
        import { readFileSync } from "node:fs";
        const fn = (await import("./#{entry}.js")).default;
        process.stdout.write(fn(JSON.parse(readFileSync("./data.json", "utf8"))));
      JS

      out, err, status = Open3.capture3("node", "run.mjs", chdir: dir)
      raise "node failed:\n#{err}" unless status.success?

      out
    end
  end
end
