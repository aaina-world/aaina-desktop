# Homebrew cask for our own tap (aaina-world/homebrew-tap): brew install aaina-world/tap/aaina-desktop
# Homebrew's main list only takes signed apps, and these builds aren't signed yet.
cask "aaina-desktop" do
  version "0.1.2"
  sha256 "5e3f89e8e697265067c0694e524c0ee1fc26f2b51d280100ea823b1f068412f9"

  url "https://github.com/aaina-world/aaina-desktop/releases/download/v#{version}/Aaina.Desktop_#{version}_universal.dmg",
      verified: "github.com/aaina-world/aaina-desktop/"
  name "Aaina Desktop"
  desc "Model photos of your products, made on your own computer"
  homepage "https://desktop.aaina.world/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :catalina"

  app "Aaina Desktop.app"

  # The app isn't signed yet, so macOS would refuse to open it from a download. It was built from public code by GitHub
  # Actions; this removes the "downloaded from the internet" mark so it opens normally.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Aaina Desktop.app"]
  end

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
