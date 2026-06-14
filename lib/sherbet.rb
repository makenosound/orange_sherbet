# frozen_string_literal: true

require_relative "sherbet/version"

# Sherbet compiles a portable subset of ERB into standalone JavaScript modules.
#
#   js, source_map = Sherbet.compile("card", File.read("card.html.erb"))
#
# The same template renders on the server with Sherbet::Renderer (real Ruby via
# Erubi) and re-renders in the browser from the compiled JS — identical output
# by construction. See the README for the supported subset.
module Sherbet
  class Error < StandardError; end

  # Raised when a template uses a construct outside the portable subset.
  class Unsupported < Error; end

  # Compile a template's ERB source to [js_source, source_map_json].
  def self.compile(name, source)
    Compiler.compile(name, source)
  end
end

require_relative "sherbet/compiler"
require_relative "sherbet/renderer"
