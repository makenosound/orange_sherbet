# frozen_string_literal: true

require_relative "orange_sherbet/version"

# OrangeSherbet compiles a portable subset of ERB into standalone JavaScript modules.
#
#   js, source_map = OrangeSherbet.compile("card", File.read("card.html.erb"))
#
# The same template renders on the server with OrangeSherbet::Renderer (real Ruby via
# Erubi) and re-renders in the browser from the compiled JS — identical output
# by construction. See the README for the supported subset.
module OrangeSherbet
  class Error < StandardError; end

  # Raised when a template uses a construct outside the portable subset.
  class Unsupported < Error; end

  # Compile a template's ERB source to [js_source, source_map_json].
  def self.compile(name, source)
    Compiler.compile(name, source)
  end
end

require_relative "orange_sherbet/compiler"
require_relative "orange_sherbet/renderer"
