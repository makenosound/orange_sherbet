# frozen_string_literal: true

require_relative "lib/orange_sherbet/version"

Gem::Specification.new do |spec|
  spec.name = "orange_sherbet"
  spec.version = OrangeSherbet::VERSION
  spec.authors = ["Max Wheeler"]
  spec.email = ["max@makenosound.com"]

  spec.summary = "Compile a portable subset of ERB to standalone JavaScript."
  spec.description = <<~DESC
    Orange Sherbet compiles ERB templates — written in a small, portable subset of
    Ruby — into self-contained JavaScript modules, so the same template renders
    on the server (real Ruby via Erubi) and re-renders in the browser. It parses
    the Ruby inside tags with Prism and emits JS through an AST + printer, with
    a source map back to the .html.erb.
  DESC
  spec.homepage = "https://github.com/makenosound/orange_sherbet"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.1.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  gemspec = File.basename(__FILE__)
  spec.files = IO.popen(%w[git ls-files -z], chdir: __dir__, err: IO::NULL) do |ls|
    ls.readlines("\x0", chomp: true).reject do |f|
      (f == gemspec) ||
        f.start_with?(*%w[bin/ test/ spec/ features/ .git .github appveyor Gemfile])
    end
  end
  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  spec.add_dependency "prism", ">= 0.24"
  spec.add_dependency "erubi", "~> 1.13"
end
