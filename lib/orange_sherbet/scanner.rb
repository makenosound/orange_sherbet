# frozen_string_literal: true

module OrangeSherbet
  # Splits an ERB template into raw segments, applying Erubi's `trim: true`
  # whitespace rules. Each segment carries the template line it starts on:
  #   [:text, string, line]
  #   [:output, ruby_src, raw_output?, line]   # <%= %> / <%== %>
  #   [:statement, ruby_src, line]              # <% %>
  # Comments (`<%# %>`) are dropped, and a non-output tag alone on its line has
  # its leading indentation and trailing newline trimmed.
  #
  # This is pure ERB structure — it knows nothing about the Ruby inside tags.
  class Scanner
    def self.scan(src) = new(src).scan

    def initialize(src)
      @src = src
    end

    def scan
      src = @src
      raw = []
      text = +""
      text_line = 1
      i = 0
      line_at = ->(pos) { src[0...pos].count("\n") + 1 }
      flush = lambda do
        (raw << [:text, text.dup, text_line]) unless text.empty?
        text.clear
      end

      while i < src.length
        open = src.index("<%", i)
        unless open
          text << src[i..]
          break
        end
        text_line = line_at.call(i) if text.empty?
        text << src[i...open]

        p = open + 2
        kind = :statement
        raw_output = false
        trim_leading = false
        if src[p] == "#"
          kind = :comment
          p += 1
        elsif src[p] == "="
          kind = :output
          p += 1
          if src[p] == "="
            raw_output = true
            p += 1
          end
        elsif src[p] == "-"
          trim_leading = true
          p += 1
        end

        close = src.index("%>", p)
        raise Unsupported, "Unterminated ERB tag" unless close

        last = close
        trim_trailing = false
        if src[close - 1] == "-"
          trim_trailing = true
          last = close - 1
        end
        inner = src[p...last].strip
        tag_line = line_at.call(open)

        non_output = kind != :output
        line_start = (src.rindex("\n", open - 1) || -1) + 1
        at_line_start = src[line_start...open].match?(/\A[ \t]*\z/)
        followed_by_newline = src[close + 2] == "\n"
        alone = non_output && at_line_start && followed_by_newline

        text.sub!(/[ \t]*\z/, "") if alone || trim_leading
        flush.call

        case kind
        when :output then raw << [:output, inner, raw_output, tag_line]
        when :statement then raw << [:statement, inner, tag_line]
        end

        i = close + 2
        i += 1 if (alone || trim_trailing) && src[i] == "\n"
      end

      flush.call
      raw
    end
  end
end
