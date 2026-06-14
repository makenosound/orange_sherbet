# frozen_string_literal: true

require "erubi"
require "json"
require "pathname"

module OrangeSherbet
  # Server-side renderer — the source of truth that OrangeSherbet's compiled JS is
  # held identical to. Runs templates through real Ruby via Erubi (the same
  # engine hanami-view uses) with `escape: true`, so `<%= %>` auto-escapes via
  # Erubi.h — matching the compiled JS's __esc (CGI.escapeHTML) table.
  #
  #   renderer = OrangeSherbet::Renderer.new("app/templates/portable")
  #   renderer.render("card", post: post)
  class Renderer
    # Wraps a plain hash so `post.title` works as an attribute read and nested
    # hashes/arrays are wrapped too. A missing key raises (matching the compiled
    # JS), keeping the read-only data contract honest. A few Hash methods are
    # delegated so the same object also works as a hash (`opts.keys`, `opts[k]`,
    # `opts.to_json`) — matching a plain JS object, which is both at once.
    class DataObject
      def initialize(hash)
        @hash = hash
      end

      def [](key) = DataObject.wrap(@hash[key.to_s])
      def keys = @hash.keys
      def values = @hash.values.map { |v| DataObject.wrap(v) }
      def key?(key) = @hash.key?(key.to_s)
      def to_json(*) = @hash.to_json

      def respond_to_missing?(name, _include_private = false)
        @hash.key?(name.to_s) || super
      end

      def method_missing(name, *_args)
        key = name.to_s
        return DataObject.wrap(@hash[key]) if @hash.key?(key)

        super
      end

      def self.wrap(value)
        case value
        when Hash then new(value)
        when Array then value.map { |v| wrap(v) }
        else value
        end
      end
    end

    # Output already known to be HTML. The escape function leaves it untouched,
    # so partial output composes without double-escaping.
    class SafeString < String
      def html_safe? = true
    end

    # The binding compiled template code runs in. Bare identifiers resolve to
    # locals via method_missing; `render` resolves partials.
    class Context
      def initialize(renderer, locals)
        @renderer = renderer
        @locals = locals
      end

      def render(name, **locals)
        SafeString.new(@renderer.render(name, locals))
      end

      # Erubi calls this for every `<%= %>`. Safe strings pass through;
      # everything else is escaped with the same table the compiled JS uses.
      def __h(value)
        return value.to_s if value.respond_to?(:html_safe?) && value.html_safe?

        ::Erubi.h(value)
      end

      def respond_to_missing?(name, _include_private = false)
        @locals.key?(name) || super
      end

      def method_missing(name, *_args)
        return @locals[name] if @locals.key?(name)

        super
      end
    end

    # templates_dir holds the .html.erb files; partials are resolved relative to
    # it by name (the same names used in `render "name"`).
    def initialize(templates_dir)
      @templates_dir = Pathname(templates_dir)
      @compiled = {}
    end

    def render(name, locals = {})
      code = compiled(name)
      wrapped = locals.each_with_object({}) { |(k, v), h| h[k.to_sym] = DataObject.wrap(v) }
      Context.new(self, wrapped).instance_eval(code, "#{name}.html.erb")
    end

    private

    def compiled(name)
      @compiled[name] ||= begin
        src = @templates_dir.join("#{name}.html.erb").read
        Erubi::Engine.new(src, escape: true, trim: true, escapefunc: "__h").src
      end
    end
  end
end
