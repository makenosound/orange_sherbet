# frozen_string_literal: true

require "pathname"
require_relative "compiler"

module OrangeSherbet
  # `orange_sherbet compile SRC_DIR OUT_DIR`
  #
  # Compiles every SRC_DIR/*.html.erb to OUT_DIR/<name>.js (+ .js.map). Intended
  # as a build step; re-run when a template changes.
  module CLI
    module_function

    def start(argv)
      command, *rest = argv
      case command
      when "compile" then compile(*rest)
      when nil, "-h", "--help", "help" then usage($stdout) || 0
      else
        warn "orange_sherbet: unknown command #{command.inspect}"
        usage($stderr)
        1
      end
    end

    def compile(src_dir = nil, out_dir = nil)
      unless src_dir && out_dir
        usage($stderr)
        return 1
      end

      src = Pathname(src_dir)
      out = Pathname(out_dir)
      out.mkpath

      count = 0
      src.glob("*.html.erb").sort.each do |path|
        name = path.basename(".html.erb").to_s
        js, map = OrangeSherbet::Compiler.compile(name, path.read)
        out.join("#{name}.js").write(js)
        out.join("#{name}.js.map").write(map)
        count += 1
      end

      puts "Compiled #{count} templates → #{out}/*.js (+ .js.map)"
      0
    end

    def usage(io)
      io.puts <<~TXT
        Usage: orange_sherbet compile SRC_DIR OUT_DIR

        Compiles SRC_DIR/*.html.erb to OUT_DIR/<name>.js (+ source maps).
      TXT
      0
    end
  end
end
