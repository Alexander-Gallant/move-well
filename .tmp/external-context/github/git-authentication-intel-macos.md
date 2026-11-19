---
source: Context7 API (filtered from official GitHub documentation)
library: GitHub / GitHub CLI
package: github-authentication
topic: Git HTTPS authentication on Intel macOS without Homebrew
tech_stack: Git on Intel macOS; Homebrew and GitHub CLI may be unavailable
fetched: 2026-11-19T00:00:00Z
official_docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
---

# Current official options

## 1. Fine-grained personal access token (HTTPS; no extra package)

1. Open GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, create a token with a short expiration, select only the required repository/repositories, and grant the minimum repository permissions. For ordinary private-repository Git read/write, use **Contents: Read and write**.
2. Use an HTTPS remote, for example:

   ```sh
   git remote set-url origin https://github.com/OWNER/REPOSITORY.git
   git pull
   git push
   ```

3. At the prompts, enter the GitHub username as **Username** and the token as **Password**. GitHub PATs are used for HTTPS Git operations, not SSH. Never put the token in the remote URL or shell history.
4. If an old credential is cached, update/delete the `github.com` Internet-password item in macOS **Keychain Access**, then retry. GitHub documents `osxkeychain` as the built-in macOS helper; check the current helper with `git config --get credential.helper`.

## 2. GitHub Desktop

1. Download the macOS build from [desktop.github.com](https://desktop.github.com/).
2. In GitHub Desktop, open **Settings → Accounts → Sign Into GitHub.com**.
3. Choose **Continue With Browser**, authenticate in the browser, and follow the prompt back to Desktop. Use Desktop to clone/push; it manages the sign-in flow without Homebrew or `gh`.

## 3. SSH (recommended alternative to repeatedly handling PATs)

```sh
ssh-keygen -t ed25519 -C "YOUR_GITHUB_EMAIL"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Add `~/.ssh/id_ed25519.pub` under **GitHub Settings → SSH and GPG keys**, test it, then switch an existing clone:

```sh
ssh -T git@github.com
```

On macOS versions before Monterey, GitHub documents `ssh-add -K ~/.ssh/id_ed25519` instead of `--apple-use-keychain`.

## 4. Official `gh` binary without Homebrew

GitHub CLI's official macOS install documentation says its releases provide precompiled **amd64** (Intel), **arm64**, and universal installers. Download the Intel/amd64 asset or the universal installer from [the official releases page](https://github.com/cli/cli/releases/latest), then run:

```sh
gh auth login
```

Select GitHub.com, choose **HTTPS**, and answer yes when asked whether Git should use the GitHub credentials. If needed afterward:

```sh
gh auth setup-git
```

This configures `gh` as Git's HTTPS credential helper. The CLI project notes that macOS `.pkg` installers are currently unsigned; use the official release asset and follow macOS's security prompt if applicable.

## Practical choice

- **No installs / command line:** fine-grained PAT + HTTPS, with credentials retained by the existing macOS Keychain helper.
- **GUI and browser sign-in:** GitHub Desktop.
- **Long-term command-line setup:** SSH.
- **Official CLI workflow:** download the Intel `gh` release binary, then `gh auth login` and `gh auth setup-git`.

## Official sources

- PATs and HTTPS Git: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- macOS Keychain credentials: https://docs.github.com/en/get-started/git-basics/updating-credentials-from-the-macos-keychain
- GitHub Desktop authentication: https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/authenticating-to-github-in-github-desktop
- GitHub Desktop download: https://desktop.github.com/
- SSH setup: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- Remote URL changes: https://docs.github.com/en/get-started/git-basics/managing-remote-repositories
- `gh` macOS installation: https://github.com/cli/cli/blob/trunk/docs/install_macos.md
- `gh` releases: https://github.com/cli/cli/releases/latest
- `gh auth login`: https://cli.github.com/manual/gh_auth_login
