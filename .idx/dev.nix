# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
  ];

  # The following attributes are used to configure your workspace.
  # They will be ignored in other environments.
  # For more information, see: https://firebase.google.com/docs/studio/customize-workspace
  idx = {
    # The list of previews to display in the side panel.
    previews = {
      enable = true;
      previews = [
        {
          displayName = "Web Frontend";
          command = ["npm", "run", "-C", "frontend", "dev"];
          port = 5173;
          portStrategy = "ignore";
        }
      ];
    };
  };
}
