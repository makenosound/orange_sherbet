# frozen_string_literal: true

RSpec.describe OrangeSherbet do
  it "has a version number" do
    expect(OrangeSherbet::VERSION).not_to be_nil
  end

  it "compiles a template to [js, source_map]" do
    js, map = OrangeSherbet.compile("greeting", "<p><%= name.upcase %></p>")
    expect(js).to include("export default function greeting")
    expect(js).to include("name.toUpperCase()")
    expect(JSON.parse(map)["version"]).to eq(3)
  end
end
