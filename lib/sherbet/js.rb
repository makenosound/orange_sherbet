# frozen_string_literal: true

require "json"

module Sherbet
  # The JS backend: AST node constructors (`j_*`) plus a Printer that renders an
  # AST to JS source and a v3 source map. This layer knows nothing about Ruby or
  # ERB — given an AST, it produces target code. The Ruby→JS lowering lives in
  # Sherbet::Compiler and consumes this.
  #
  # `include Js` makes the `j_*` constructors available as private helpers.
  module Js
    module_function

    def j_ident(name) = {k: :ident, name: name}
    def j_num(value) = {k: :num, value: value}
    def j_bool(value) = {k: :bool, value: value}
    def j_null = {k: :null}
    def j_str(value) = {k: :str, value: value}
    def j_tpl(parts) = {k: :tpl, parts: parts}
    def j_array(elements) = {k: :array, elements: elements}
    def j_object(pairs) = {k: :object, pairs: pairs}
    def j_member(obj, name, optional: false) = {k: :member, obj: obj, name: name, optional: optional}
    def j_index(obj, index) = {k: :index, obj: obj, index: index}
    def j_call(callee, args) = {k: :call, callee: callee, args: args}
    def j_new(callee, args) = {k: :new, callee: callee, args: args}
    def j_spread(expr) = {k: :spread, expr: expr}
    def j_arrow(params, body) = {k: :arrow, params: params, body: body}
    def j_unary(op, operand) = {k: :unary, op: op, operand: operand}
    def j_binary(op, left, right) = {k: :binary, op: op, left: left, right: right}
    def j_ternary(cond, then_, else_) = {k: :ternary, cond: cond, then: then_, else: else_}

    # AST → JS string + source map.
    #
    # Owns parenthesisation (from an operator-precedence table), string/template
    # escaping, and source-map recording. Each statement carries the template
    # line it came from; the printer records (generated position → source line)
    # mappings as it writes.
    class Printer
      PREC = {
        "*" => 13, "/" => 13, "%" => 13, "+" => 12, "-" => 12,
        "<" => 10, "<=" => 10, ">" => 10, ">=" => 10, "in" => 10,
        "==" => 9, "!=" => 9, "===" => 9, "!==" => 9,
        "&&" => 5, "||" => 4
      }.freeze
      CALL = 18
      UNARY = 15
      TERNARY = 3
      ARROW = 2
      LOWEST = 1

      def initialize
        @out = +""
        @gen_line = 0
        @gen_col = 0
        @mappings = [] # [gen_line, gen_col, src_line, src_col]
      end

      def output = @out

      # Emit a verbatim line (imports, helpers, function header) — no mapping.
      def line(str)
        write(str)
        write("\n")
      end

      def stmt(node, indent)
        pad = "  " * indent
        case node[:type]
        when :append
          write(pad)
          mark(node[:line])
          write("__o += ")
          expr(node[:expr], LOWEST)
          write(";\n")
        when :assign
          write(pad)
          mark(node[:line])
          write("#{node[:name]} = ")
          expr(node[:expr], LOWEST)
          write(";\n")
        when :assign_if
          write(pad)
          mark(node[:line])
          write("if (")
          expr(node[:cond], LOWEST)
          write(") { #{node[:name]} = ")
          expr(node[:expr], LOWEST)
          write("; }\n")
        when :if
          write(pad)
          mark(node[:line])
          node[:branches].each_with_index do |(cond, body), idx|
            if idx.zero?
              write("if (")
              expr(cond, LOWEST)
              write(") {\n")
            elsif cond
              write(" else if (")
              expr(cond, LOWEST)
              write(") {\n")
            else
              write(" else {\n")
            end
            body.each { |s| stmt(s, indent + 1) }
            write("#{pad}}")
          end
          write("\n")
        when :foreach
          write(pad)
          mark(node[:line])
          expr(node[:recv], CALL)
          sig = node[:with_index] ? "(#{node[:params][0]}, #{node[:params][1] || "__i"})" : "(#{node[:params][0]})"
          write(".forEach(#{sig} => {\n")
          node[:body].each { |s| stmt(s, indent + 1) }
          write("#{pad}});\n")
        end
      end

      # Build a v3 source map. Line-granular: maps each statement's generated
      # position to (template line, column 0).
      def source_map(source_name, source_content)
        JSON.generate(
          version: 3,
          sources: [source_name],
          sourcesContent: [source_content],
          names: [],
          mappings: encode_mappings
        )
      end

      private

      def write(str)
        @out << str
        if (nl = str.rindex("\n"))
          @gen_line += str.count("\n")
          @gen_col = str.length - nl - 1
        else
          @gen_col += str.length
        end
      end

      def mark(src_line)
        return unless src_line

        seg = [@gen_line, @gen_col, src_line - 1, 0]
        @mappings << seg unless @mappings.last == seg
      end

      # Print an expression, wrapping in parens when its precedence is looser
      # than the surrounding context requires.
      def expr(node, min)
        prec = prec_of(node)
        wrap = prec < min
        write("(") if wrap
        emit_expr(node)
        write(")") if wrap
      end

      def prec_of(node)
        case node[:k]
        when :binary then PREC.fetch(node[:op], 9)
        when :unary then UNARY
        when :ternary then TERNARY
        when :arrow then ARROW
        when :spread then LOWEST
        when :call, :new, :member, :index then CALL
        else 20 # primaries
        end
      end

      def emit_expr(node)
        case node[:k]
        when :ident then write(node[:name])
        when :num then write(node[:value].to_s)
        when :bool then write(node[:value] ? "true" : "false")
        when :null then write("null")
        when :str then write(quote(node[:value]))
        when :tpl then emit_template(node[:parts])
        when :array
          write("[")
          join(node[:elements], LOWEST)
          write("]")
        when :object
          write("{ ")
          node[:pairs].each_with_index do |(key, val), i|
            write(", ") if i.positive?
            write("#{key}: ")
            expr(val, LOWEST)
          end
          write(" }")
        when :member
          expr(node[:obj], CALL)
          write(node[:optional] ? "?." : ".")
          write(node[:name])
        when :index
          expr(node[:obj], CALL)
          write("[")
          expr(node[:index], LOWEST)
          write("]")
        when :call
          expr(node[:callee], CALL)
          write("(")
          join(node[:args], LOWEST)
          write(")")
        when :new
          write("new ")
          expr(node[:callee], CALL)
          write("(")
          join(node[:args], LOWEST)
          write(")")
        when :spread
          write("...")
          expr(node[:expr], ARROW)
        when :arrow
          write("(#{node[:params].join(", ")}) => ")
          expr(node[:body], ARROW)
        when :unary
          write(node[:op])
          expr(node[:operand], UNARY)
        when :binary
          p = PREC.fetch(node[:op], 9)
          expr(node[:left], p)
          write(" #{node[:op]} ")
          expr(node[:right], p + 1)
        when :ternary
          expr(node[:cond], TERNARY + 1)
          write(" ? ")
          expr(node[:then], TERNARY)
          write(" : ")
          expr(node[:else], TERNARY)
        end
      end

      def join(nodes, min)
        nodes.each_with_index do |n, i|
          write(", ") if i.positive?
          expr(n, min)
        end
      end

      def emit_template(parts)
        write("`")
        parts.each do |part|
          if part.is_a?(String)
            write(escape_template(part))
          else
            write("${")
            expr(part, LOWEST)
            write("}")
          end
        end
        write("`")
      end

      def quote(str)
        escaped = str.gsub("\\", "\\\\\\\\").gsub('"', '\\"')
          .gsub("\n", "\\n").gsub("\t", "\\t").gsub("\r", "\\r")
        "\"#{escaped}\""
      end

      def escape_template(str)
        str.gsub("\\", "\\\\\\\\").gsub("`", "\\\\`").gsub("${", "\\${")
      end

      BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

      def encode_mappings
        prev_src_line = 0
        prev_src_col = 0
        by_line = @mappings.group_by(&:first)
        max_line = @mappings.map(&:first).max || 0

        (0..max_line).map do |gen_line|
          prev_gen_col = 0
          segs = (by_line[gen_line] || []).sort_by { |m| m[1] }
          segs.map do |(_gl, gen_col, src_line, src_col)|
            s = vlq(gen_col - prev_gen_col) + vlq(0) + vlq(src_line - prev_src_line) + vlq(src_col - prev_src_col)
            prev_gen_col = gen_col
            prev_src_line = src_line
            prev_src_col = src_col
            s
          end.join(",")
        end.join(";")
      end

      def vlq(num)
        v = num.negative? ? ((-num) << 1) | 1 : num << 1
        out = +""
        loop do
          digit = v & 0x1f
          v >>= 5
          digit |= 0x20 if v.positive?
          out << BASE64[digit]
          break unless v.positive?
        end
        out
      end
    end
  end
end
