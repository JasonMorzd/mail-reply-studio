#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash scripts/server-setup.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git unzip docker.io docker-compose-plugin

systemctl enable docker
systemctl start docker

if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
fi

mkdir -p /opt/mail-reply-studio

echo "Server base setup is done."
echo "Upload the project to /opt/mail-reply-studio, then create .env and run:"
echo "docker compose -f docker-compose.prod.yml up -d --build"
echo "If the user was added to the docker group, log out and log in again before running docker without sudo."
