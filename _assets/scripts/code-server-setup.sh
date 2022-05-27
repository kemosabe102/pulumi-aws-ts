# Original file: https://github.com/chilcano/aws-cdk-examples/blob/main/code-server-ec2/_assets/scripts/cloud_devops_tools.sh


printf "==> Installing tools to allow SSH into code-server on VS Code \n"
DEBIAN_FRONTEND=noninteractive apt install wget unzip openssh-server

printf "==> Installing docker.io \n"
DEBIAN_FRONTEND=noninteractive apt install -y docker.io
apt-mark hold docker.io
# Point Docker at big ephemeral drive and turn on log rotation
systemctl stop docker
mkdir /mnt/docker
chmod 711 /mnt/docker
cat <<EOF > /etc/docker/daemon.json
{
    "data-root": "/mnt/docker",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "5"
    }
}
EOF
systemctl start docker
systemctl enable docker
# Pass bridged IPv4 traffic to iptables chains
service procps start
printf "==> Installing Code-Server \n"
#wget -q https://code-server.dev/install.sh
#chmod +x install.sh
#./install.sh
curl -fsSL https://code-server.dev/install.sh | sh
printf "==> Running Code-Server as systemd service for the user '$USER' \n"
sudo systemctl enable --now code-server@$USER
printf "==> Installing VS Code Extension: Shan.code-settings-sync. \n"
code-server --install-extension Shan.code-settings-sync
printf "==> Get a trusted Gist ID to restore extensions and configurations through Settings-Sync Extension:\n"
printf "==> You can use this: https://gist.github.com/chilcano/b5f88127bd2d89289dc2cd36032ce856 \n\n"
printf "==> Restarting Code-Server to apply changes. \n"
sudo systemctl restart code-server@$USER

printf "==> Installation of tooling successful!! <== \n"