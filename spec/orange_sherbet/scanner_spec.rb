# frozen_string_literal: true

RSpec.describe OrangeSherbet::Scanner do
  def scan(src) = described_class.scan(src)

  it "splits text and tags, carrying the template line" do
    segments = scan("<p><%= name %></p>")
    expect(segments).to eq([
      [:text, "<p>", 1],
      [:output, "name", false, 1],
      [:text, "</p>", 1]
    ])
  end

  it "marks <%== %> as raw output" do
    expect(scan("<%== x %>")).to eq([[:output, "x", true, 1]])
  end

  it "drops comments, leaving only text segments" do
    segments = scan("a<%# note %>b")
    expect(segments.map(&:first)).to all(eq(:text))
    expect(segments.map { |s| s[1] }.join).to eq("ab")
  end

  it "trims a non-output tag alone on its line (Erubi trim)" do
    # The `<% ... %>` line's leading indent and trailing newline are removed,
    # so the only text is the body between the tags.
    src = "<ul>\n  <% if show %>\n    <li>x</li>\n  <% end %>\n</ul>\n"
    text = scan(src).select { |s| s[0] == :text }.map { |s| s[1] }.join
    expect(text).to eq("<ul>\n    <li>x</li>\n</ul>\n")
  end

  it "raises on an unterminated tag" do
    expect { scan("<%= oops") }.to raise_error(OrangeSherbet::Unsupported, /Unterminated/)
  end
end
