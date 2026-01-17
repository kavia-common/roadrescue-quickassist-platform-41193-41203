#!/bin/bash
cd /home/kavia/workspace/code-generation/roadrescue-quickassist-platform-41193-41203/frontend_admin_panel
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

