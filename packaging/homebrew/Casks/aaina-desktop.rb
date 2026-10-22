# Homebrew cask for our own tap (aaina-world/homebrew-tap): brew install aaina-world/tap/aaina-desktop
# Homebrew's main list only takes signed apps, and these builds aren't signed yet.
cask "aaina-desktop" do
  version "0.1.3"
  sha256 "9867d513d18fda317b1b30c99d6391dff76688e8b0fc39dfd9c365e1300104d7"

  url "https://github.com/aaina-world/aaina-desktop/releases/download/v#{version}/Aaina.Desktop_#{version}_universal.dmg",
      verified: "github.com/aaina-world/aaina-desktop/"
  name "Aaina Desktop"
  desc "Model photos of your products, made on your own computer"
  homepage "https://desktop.aaina.world/"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Aaina Desktop.app"

  caveats <<~EOS
    Aaina Desktop isn't signed by Apple yet, so macOS asks once before it opens.
    Open the app, then go to System Settings, Privacy & Security, and choose Open Anyway.
  EOS

  zap trash: [
    "~/Library/Application Support/world.aaina.desktop",
    "~/Library/Caches/aaina-desktop",
    "~/Library/Caches/world.aaina.desktop",
    "~/Library/Logs/world.aaina.desktop",
    "~/Library/Preferences/world.aaina.desktop.plist",
    "~/Library/Saved Application State/world.aaina.desktop.savedState",
    "~/Library/WebKit/aaina-desktop",
    "~/Library/WebKit/world.aaina.desktop",
  ]
end
