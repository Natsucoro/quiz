{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [ pkgs.nodejs_20 ];
  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          # $PORT を使って起動するように指示します
          command = ["npm" "--prefix" "frontend" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}