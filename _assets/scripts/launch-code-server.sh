#!/bin/sh

# ################################################################################
# Code from: https://github.com/alec-hs/coder-cloudflare-setup/blob/main/setup.sh
# Modified by: apalermo
# ################################################################################

# Update server
sudo apt update -y && sudo apt upgrade -y

# Install git
sudo add-apt-repository ppa:git-core/ppa -y
sudo apt update -y && sudo apt install git -y

# create a code-server user
adduser --disabled-password --gecos "" coder
echo "coder ALL=(ALL:ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/coder
usermod -aG sudo coder

# copy ssh keys from root
cp -r /root/.ssh /home/coder/.ssh
chown -R coder:coder /home/coder/.ssh

# Download & install Coder
export HOME=/root
curl -fsSL https://code-server.dev/install.sh | sh

# Download service file from repo
curl https://raw.githubusercontent.com/alec-hs/coder-cloudflare-setup/main/code-server.service --output /etc/systemd/system/code-server.service

# Update coder file with proxy domain
proxyDomain="dev01.salsitatech.com"
sed -i.bak "s/mydomain.com/${proxyDomain}/" /etc/systemd/system/code-server.service

# Run Coder & run on boot
systemctl enable --now code-server@coder

# Install caddy for remote access
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo apt-key add -
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update -y && sudo apt install caddy -y

# Remove default caddyfile and cp our config
CADDYFILE='/etc/caddy/Caddyfile'
if [ -f "${CADDYFILE}" ]; then
    sudo rm "${CADDYFILE}"
fi
# Wait for new caddyfile to be copied in Pulumi
while [ ! -f /etc/caddy/Caddyfile.dev01 ]; do
    sleep 1
done
sudo cp /etc/caddy/Caddyfile.dev01 "${CADDYFILE}"

# Reload Caddy and Coder
sudo systemctl stop code-server
sudo systemctl start code-server
sudo systemctl stop caddy
sudo systemctl start caddy
