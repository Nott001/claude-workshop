let
  config = {
    allowUnfree = true;
  };
  pkgs = import <nixpkgs> { inherit config; };
in
pkgs.mkShell {
    packages = with pkgs; [
        nodejs
        pnpm
        ngrok
        supabase-cli
    ];
}
