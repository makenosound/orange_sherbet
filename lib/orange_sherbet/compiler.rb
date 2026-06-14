# frozen_string_literal: true

require "prism"
require_relative "scanner"
require_relative "js"

module OrangeSherbet
  # Compiles a portable .html.erb template to a self-contained JS module.
  #
  # The pipeline: Scanner splits the template into segments (+ Erubi trim), this
  # class builds a control-flow tree and lowers the Ruby in each tag — via
  # Prism, the real Ruby parser — into a JS AST (the `j_*` nodes from Js), and
  # Js::Printer renders that AST to source + a source map.
  #
  # This class owns the Ruby→JS lowering: the dialect-specific part. The ERB
  # structure (Scanner) and the JS backend (Js) are separate so each can be
  # tested and grown independently.
  #
  # Ruby/JS semantics resolved at compile time: method calls → inline JS,
  # attribute reads → property access, escape-or-not → decided here, partials →
  # JS imports, defined? → (x !== undefined), &. → ?.. The body is a statement
  # buffer (`let __o = ""; __o += ...; return __o`) so assignment and control
  # flow are real statements. Three value-dependent helpers stay inlined: __esc
  # (HTML escape), __s (nil-safe to_s), __truthy (Ruby truthiness).
  class Compiler
    include Js

    HELPERS = <<~JS
      const __esc = (v) =>
        v == null
          ? ""
          : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      const __s = (v) => (v == null ? "" : String(v));
      const __truthy = (v) => v != null && v !== false;
    JS

    BINARY = {:== => "===", :!= => "!==", :< => "<", :> => ">", :<= => "<=", :>= => ">=",
              :+ => "+", :- => "-", :* => "*", :/ => "/", :% => "%"}.freeze

    def self.compile(name, source)
      new.compile(name, source)
    end

    # Returns [js_source, source_map_json].
    def initialize
      @partials = []
      @reads = []
      @assigns = []
      @block_params = []
    end

    def compile(name, source)
      body = emit_body(build(Scanner.scan(source)))
      destructure = (@reads.uniq - @assigns.uniq - @block_params.uniq).sort

      printer = Js::Printer.new
      printer.line("// AUTO-GENERATED from #{name}.html.erb — do not edit.")
      @partials.uniq.each { |p| printer.line("import #{p} from \"./#{p}.js\";") }
      HELPERS.each_line { |l| printer.line(l.chomp) }
      printer.line("")
      printer.line("export default function #{name}(locals = {}) {")
      printer.line("  const { #{destructure.join(", ")} } = locals;") unless destructure.empty?
      printer.line("  let #{@assigns.uniq.sort.join(", ")};") unless @assigns.empty?
      printer.line("  let __o = \"\";")
      body.each { |stmt| printer.stmt(stmt, 1) }
      printer.line("  return __o;")
      printer.line("}")
      printer.line("//# sourceMappingURL=#{name}.js.map")

      [printer.output, printer.source_map("#{name}.html.erb", source)]
    end

    private

    # --- build control-flow tree ---------------------------------------------

    KW = /\A(if|elsif|else|unless|end)\b/
    EACH = /\A(.*)\.each(_with_index)?\s+do\s*\|([^|]*)\|\s*\z/m

    def build(items)
      cur = [0]
      nodes = parse_seq(items, cur, [])
      raise Unsupported, "Unexpected <% end %>" if cur[0] < items.length

      nodes
    end

    def parse_seq(items, cur, stops)
      nodes = []
      while cur[0] < items.length
        item = items[cur[0]]
        case item[0]
        when :text
          nodes << [:text, item[1], item[2]]
          cur[0] += 1
        when :output
          nodes << [:output, item[1], item[2], item[3]]
          cur[0] += 1
        when :statement
          kw = item[1][KW, 1]
          return nodes if stops.include?(kw)

          if %w[if unless].include?(kw)
            nodes << parse_if(items, cur)
          elsif (m = item[1].match(EACH))
            line = item[2]
            cur[0] += 1
            body = parse_seq(items, cur, ["end"])
            expect_end(items, cur)
            nodes << [:each, m[1].strip, m[2] == "_with_index", m[3].split(",").map(&:strip), body, line]
          else
            nodes << [:stmt, item[1], item[2]]
            cur[0] += 1
          end
        end
      end
      raise Unsupported, "Missing <% end %>" unless stops.empty?

      nodes
    end

    def parse_if(items, cur)
      opener, _kw, line = items[cur[0]][1], nil, items[cur[0]][2]
      cur[0] += 1
      negate = opener.start_with?("unless")
      cond = opener.sub(/\A(if|unless)\b/, "").strip
      branches = [[negate ? "!(#{cond})" : cond, parse_seq(items, cur, %w[elsif else end])]]

      loop do
        item = items[cur[0]]
        break unless item && item[0] == :statement

        kw = item[1][KW, 1]
        if kw == "elsif"
          cur[0] += 1
          branches << [item[1].sub(/\Aelsif\b/, "").strip, parse_seq(items, cur, %w[elsif else end])]
        elsif kw == "else"
          cur[0] += 1
          branches << [nil, parse_seq(items, cur, %w[end])]
          break
        else
          break
        end
      end

      expect_end(items, cur)
      [:if, branches, line]
    end

    def expect_end(items, cur)
      item = items[cur[0]]
      raise Unsupported, "Expected <% end %>" unless item && item[0] == :statement && item[1][KW, 1] == "end"

      cur[0] += 1
    end

    # --- lower the tree + Ruby expressions into a JS AST ---------------------

    def emit_body(nodes)
      nodes.map { |n| emit_stmt(n) }
    end

    def emit_stmt(node)
      case node[0]
      when :text
        {type: :append, expr: j_tpl([node[1]]), line: node[2]}
      when :output
        expr = parse_expr(node[1])
        safe = node[2] || partial_call?(expr)
        wrapped = j_call(j_ident(safe ? "__s" : "__esc"), [emit_expr(expr)])
        {type: :append, expr: wrapped, line: node[3]}
      when :stmt
        emit_assignment(node[1], node[2])
      when :if
        branches = node[1].map { |cond, body| [cond && truthy(parse_expr(cond)), emit_body(body)] }
        {type: :if, branches: branches, line: node[2]}
      when :each
        params = node[3]
        @block_params.concat(params)
        {type: :foreach, recv: emit_expr(parse_expr(node[1])), with_index: node[2],
         params: params, body: emit_body(node[4]), line: node[5]}
      end
    end

    # `x = expr`, optionally guarded by a trailing `if`/`unless` modifier.
    def emit_assignment(src, line)
      node = parse_expr(src)
      case node
      when Prism::LocalVariableWriteNode
        @assigns << node.name.to_s
        {type: :assign, name: node.name.to_s, expr: emit_expr(node.value), line: line}
      when Prism::IfNode, Prism::UnlessNode
        write = (node.statements&.body || []).first
        unless write.is_a?(Prism::LocalVariableWriteNode) && node.statements.body.size == 1
          raise Unsupported, "Unsupported statement: <% #{src} %>"
        end

        @assigns << write.name.to_s
        cond = node.is_a?(Prism::UnlessNode) ? j_unary("!", truthy(node.predicate)) : truthy(node.predicate)
        {type: :assign_if, name: write.name.to_s, cond: cond, expr: emit_expr(write.value), line: line}
      else
        raise Unsupported, "Unsupported statement: <% #{src} %>"
      end
    end

    # --- expressions via Prism → JS AST -------------------------------------

    def parse_expr(src)
      result = Prism.parse(src)
      raise Unsupported, "Parse error in `#{src}`: #{result.errors.map(&:message).join(", ")}" if result.failure?

      result.value.statements.body.first
    end

    def partial_call?(node)
      node.is_a?(Prism::CallNode) && node.receiver.nil? && node.name == :render
    end

    def truthy(prism_node)
      j_call(j_ident("__truthy"), [emit_expr(prism_node)])
    end

    def emit_expr(node)
      case node
      when Prism::OrNode
        # ((__l) => __truthy(__l) ? __l : RIGHT)(LEFT) — Ruby || returns an
        # operand with Ruby truthiness, evaluating RIGHT only when needed.
        arrow = j_arrow(["__l"], j_ternary(j_call(j_ident("__truthy"), [j_ident("__l")]),
          j_ident("__l"), emit_expr(node.right)))
        j_call(arrow, [emit_expr(node.left)])
      when Prism::AndNode
        arrow = j_arrow(["__l"], j_ternary(j_call(j_ident("__truthy"), [j_ident("__l")]),
          emit_expr(node.right), j_ident("__l")))
        j_call(arrow, [emit_expr(node.left)])
      when Prism::IfNode # ternary `a ? b : c`
        els = node.subsequent&.statements&.body&.first
        j_ternary(truthy(node.predicate), emit_expr(node.statements.body.first),
          els ? emit_expr(els) : j_str(""))
      when Prism::DefinedNode
        j_binary("!==", emit_expr(node.value), j_ident("undefined"))
      when Prism::CallNode
        emit_call(node)
      when Prism::LocalVariableReadNode
        @reads << node.name.to_s
        j_ident(node.name.to_s)
      when Prism::StringNode, Prism::SymbolNode
        j_str(node.unescaped)
      when Prism::InterpolatedStringNode
        parts = node.parts.map do |part|
          part.is_a?(Prism::StringNode) ? part.unescaped : j_call(j_ident("__s"), [emit_expr(part.statements.body.first)])
        end
        j_tpl(parts)
      when Prism::IntegerNode, Prism::FloatNode
        j_num(node.value)
      when Prism::TrueNode then j_bool(true)
      when Prism::FalseNode then j_bool(false)
      when Prism::NilNode then j_null
      when Prism::ParenthesesNode
        emit_expr(node.body.body.first)
      when Prism::ArrayNode
        j_array(node.elements.map { |e| emit_expr(e) })
      when Prism::HashNode, Prism::KeywordHashNode
        j_object(node.elements.map { |a| [a.key.unescaped, emit_expr(a.value)] })
      else
        raise Unsupported, "Unsupported expression node: #{node.class.name.split("::").last}"
      end
    end

    def emit_call(node)
      args = node.arguments&.arguments || []

      if node.receiver.nil?
        return emit_render(args) if node.name == :render
        raise Unsupported, "Unknown helper `#{node.name}`" unless args.empty? && node.block.nil?

        @reads << node.name.to_s
        return j_ident(node.name.to_s)
      end

      recv = emit_expr(node.receiver)
      arg_nodes = args.map { |a| emit_expr(a) }

      return j_binary(BINARY[node.name], recv, arg_nodes.first) if BINARY.key?(node.name)
      return j_unary("!", j_call(j_ident("__truthy"), [recv])) if node.name == :!
      return j_unary("-", recv) if node.name == :-@

      rewritten = rewrite_method(node.name, recv, arg_nodes)
      return rewritten if rewritten

      raise Unsupported, "Method `#{node.name}` is not in the portable subset" unless args.empty? && node.block.nil?

      j_member(recv, node.name.to_s, optional: node.safe_navigation?)
    end

    # Maps a whitelisted Ruby method to a JS AST expression. Names shared across
    # types (length/empty?/any?/include?/first/last) resolve to the
    # string/array reading; Hash uses explicit keys/values. Returns nil if the
    # method isn't in the subset.
    def rewrite_method(name, r, a)
      case name
      when :upcase then j_call(j_member(r, "toUpperCase"), [])
      when :downcase then j_call(j_member(r, "toLowerCase"), [])
      when :capitalize
        j_binary("+", j_call(j_member(j_call(j_member(r, "charAt"), [j_num(0)]), "toUpperCase"), []),
          j_call(j_member(j_call(j_member(r, "slice"), [j_num(1)]), "toLowerCase"), []))
      when :strip then j_call(j_member(r, "trim"), [])
      when :reverse
        j_call(j_member(j_call(j_member(j_array([j_spread(r)]), "reverse"), []), "join"), [j_str("")])
      when :start_with? then j_call(j_member(r, "startsWith"), a)
      when :end_with? then j_call(j_member(r, "endsWith"), a)
      when :split then j_call(j_member(r, "split"), a)
      when :length, :size, :count then j_member(r, "length")
      when :empty? then j_binary("===", j_member(r, "length"), j_num(0))
      when :any? then j_binary(">", j_member(r, "length"), j_num(0))
      when :none? then j_binary("===", j_member(r, "length"), j_num(0))
      when :include? then j_call(j_member(r, "includes"), a)
      when :index then j_call(j_member(r, "indexOf"), a)
      when :first then a.empty? ? j_index(r, j_num(0)) : j_call(j_member(r, "slice"), [j_num(0), a.first])
      when :last then a.empty? ? j_index(r, j_binary("-", j_member(r, "length"), j_num(1))) : j_call(j_member(r, "slice"), [j_unary("-", a.first)])
      when :join then j_call(j_member(j_call(j_member(r, "map"), [j_ident("__s")]), "join"), [a.first || j_str("")])
      when :uniq then j_array([j_spread(j_new(j_ident("Set"), [r]))])
      when :compact then j_call(j_member(r, "filter"), [j_arrow(["__v"], j_binary("!=", j_ident("__v"), j_null))])
      when :flatten then j_call(j_member(r, "flat"), [j_ident("Infinity")])
      when :sum then j_call(j_member(r, "reduce"), [j_arrow(%w[__a __b], j_binary("+", j_ident("__a"), j_ident("__b"))), j_num(0)])
      when :min then j_call(j_member(j_ident("Math"), "min"), [j_spread(r)])
      when :max then j_call(j_member(j_ident("Math"), "max"), [j_spread(r)])
      when :take then j_call(j_member(r, "slice"), [j_num(0), a.first])
      when :drop then j_call(j_member(r, "slice"), a)
      when :to_a then j_array([j_spread(r)])
      when :keys then j_call(j_member(j_ident("Object"), "keys"), [r])
      when :values then j_call(j_member(j_ident("Object"), "values"), [r])
      when :key?, :has_key? then j_binary("in", a.first, r)
      when :zero? then j_binary("===", r, j_num(0))
      when :positive? then j_binary(">", r, j_num(0))
      when :negative? then j_binary("<", r, j_num(0))
      when :abs then j_call(j_member(j_ident("Math"), "abs"), [r])
      when :round then j_call(j_member(j_ident("Math"), "round"), [r])
      when :to_i then j_call(j_ident("parseInt"), [r, j_num(10)])
      when :to_f then j_call(j_ident("parseFloat"), [r])
      when :to_s then j_call(j_ident("__s"), [r])
      when :nil? then j_binary("==", r, j_null)
      when :to_json then j_call(j_member(j_ident("JSON"), "stringify"), [r])
      end
    end

    def emit_render(args)
      name = args.first.unescaped
      @partials << name
      kw = args[1]
      pairs = kw.is_a?(Prism::KeywordHashNode) ? kw.elements : []
      j_call(j_ident(name), [j_object(pairs.map { |a| [a.key.unescaped, emit_expr(a.value)] })])
    end
  end
end
