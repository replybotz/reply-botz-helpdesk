#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Reply Botz HD — Bootstrap Script
# ============================================
# Installs prerequisites and launches the GUI installer.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/replybotz/reply-botz-helpdesk/main/installer/setup.sh)
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_URL="https://github.com/replybotz/reply-botz-helpdesk.git"
INSTALL_DIR="$HOME/reply-botz-helpdesk"

echo -e "${CYAN}"
echo "  ____            _         ____        _          _   _ ____  "
echo " |  _ \\ ___ _ __ | |_   _  | __ )  ___ | |_ ____  | | | |  _ \\ "
echo " | |_) / _ \\ '_ \\| | | | | |  _ \\ / _ \\| __|_  /  | |_| | | | |"
echo " |  _ <  __/ |_) | | |_| | | |_) | (_) | |_ / /   |  _  | |_| |"
echo " |_| \\_\\___| .__/|_|\\__, | |____/ \\___/ \\__/___|  |_| |_|____/ "
echo "           |_|      |___/                                       "
echo -e "${NC}"
echo -e "${GREEN}GUI Installer Bootstrap${NC}"
echo ""

# --- Node.js ---
echo -e "${YELLOW}Checking Node.js...${NC}"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | grep -oP '\d+' | head -1)
  if [ "$NODE_VER" -ge 20 ]; then
    echo -e "  ${GREEN}Node.js $(node -v) detected${NC}"
  else
    echo -e "  ${YELLOW}Node.js $(node -v) is too old (need 20+). Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
  fi
else
  echo -e "  ${YELLOW}Node.js not found. Installing...${NC}"
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs
  else
    echo -e "  ${RED}Unsupported package manager. Install Node.js 20+ manually.${NC}"
    exit 1
  fi
fi

# --- Docker ---
echo -e "${YELLOW}Checking Docker...${NC}"
if command -v docker &>/dev/null; then
  echo -e "  ${GREEN}Docker $(docker --version | grep -oP '\d+\.\d+\.\d+') detected${NC}"
else
  echo -e "  ${YELLOW}Docker not found. Installing...${NC}"
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
  echo -e "  ${GREEN}Docker installed. You may need to log out and back in for group changes.${NC}"
fi

# --- Docker Compose ---
echo -e "${YELLOW}Checking Docker Compose...${NC}"
if docker compose version &>/dev/null; then
  echo -e "  ${GREEN}Docker Compose $(docker compose version --short) detected${NC}"
else
  echo -e "  ${RED}Docker Compose V2 not available. It should come with Docker.${NC}"
  echo -e "  ${RED}Try: sudo apt-get install docker-compose-plugin${NC}"
  exit 1
fi

# --- Git ---
echo -e "${YELLOW}Checking git...${NC}"
if command -v git &>/dev/null; then
  echo -e "  ${GREEN}git $(git --version | grep -oP '\d+\.\d+\.\d+') detected${NC}"
else
  echo -e "  ${YELLOW}git not found. Installing...${NC}"
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y git
  elif command -v yum &>/dev/null; then
    sudo yum install -y git
  fi
fi

# --- Clone repo ---
echo ""
echo -e "${YELLOW}Setting up Reply Botz HD...${NC}"
if [ -d "$INSTALL_DIR" ]; then
  echo -e "  ${GREEN}Directory already exists at $INSTALL_DIR${NC}"
  cd "$INSTALL_DIR"
  git pull origin main 2>/dev/null || true
else
  echo -e "  Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# --- Launch installer ---
echo ""
echo -e "${GREEN}Launching GUI installer...${NC}"
echo ""
node installer/server.js
