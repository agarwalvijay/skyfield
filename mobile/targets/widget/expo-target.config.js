/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "SkyfieldWidget",
  // Share the snapshot the RN app writes via ExtensionStorage.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.atsumilabs.skyfield"],
  },
};
